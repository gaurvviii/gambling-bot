import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BlackjackGame } from '../lib/games/blackjackGame.js';
import { getUser } from '../lib/user.js';
import { prisma } from '../lib/database.js';

// Define the games map to track active games
const games = new Map();

export class BlackjackCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'blackjack',
      description: 'Play a game of blackjack'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addIntegerOption((option) =>
          option
            .setName('bet')
            .setDescription('Amount to bet')
            .setRequired(true)
            .setMinValue(1)
        )
    );
  }

  async chatInputRun(interaction) {
    try {
      // Defer the reply immediately to prevent interaction timeout
      await interaction.deferReply();

      const userId = interaction.user.id;
      if (games.has(userId)) {
        return interaction.editReply('You already have a game in progress!');
      }

      const bet = interaction.options.getInteger('bet');
      const user = await getUser(userId);

      if (user.wallet < bet) {
        return interaction.editReply('Insufficient funds in wallet!');
      }

      // Deduct bet amount
      await prisma.user.update({
        where: { id: userId },
        data: {
          wallet: { decrement: bet }
        }
      });

      const game = new BlackjackGame();
      games.set(userId, { game, bet });
      game.dealInitialCards();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hit')
          .setLabel('Hit')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stand')
          .setLabel('Stand')
          .setStyle(ButtonStyle.Secondary)
      );

      const response = await interaction.editReply({
        content: this.getGameState(game),
        components: [buttons]
      });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 20000 // Reduced from 30000 to 20000
      });

      collector.on('collect', async (i) => {
        try {
          if (i.user.id !== userId) {
            return i.reply({ content: 'This is not your game!', ephemeral: true });
          }

          const gameData = games.get(userId);
          if (!gameData) {
            return i.update({ content: 'This game has expired.', components: [] });
          }

          const game = gameData.game;

          if (i.customId === 'hit') {
            game.hit(game.playerHand);
            const playerValue = game.getHandValue(game.playerHand);

            if (playerValue > 21) {
              await this.endGame(i, game, userId, 'bust');
              collector.stop();
            } else {
              await i.update({ content: this.getGameState(game), components: [buttons] });
            }
          } else if (i.customId === 'stand') {
            game.dealerPlay();
            const result = this.determineWinner(game);
            await this.endGame(i, game, userId, result);
            collector.stop();
          }
        } catch (error) {
          console.error('Error in button interaction:', error);
          try {
            await i.update({ content: 'An error occurred. The game has been cancelled.', components: [] });
          } catch (updateError) {
            console.error('Error updating interaction:', updateError);
          }
          games.delete(userId);
          collector.stop();
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time') {
          try {
            await interaction.editReply({
              content: 'Game expired due to inactivity!',
              components: []
            });
          } catch (error) {
            console.error('Error updating expired game:', error);
          }
          games.delete(userId);
        }
      });
    } catch (error) {
      console.error('Error occurred in BlackjackCommand:', error);
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply('An error occurred while processing your request. Please try again later.');
        } else {
          await interaction.editReply('An error occurred while processing your request. Please try again later.');
        }
      } catch (replyError) {
        console.error('Error sending error message:', replyError);
      }
    }
  }

  getGameState(game) {
    return `
🎰 Blackjack 🎰
Dealer's hand: ${game.formatCard(game.dealerHand[0])} ??
Dealer's value: ??

Your hand: ${game.formatHand(game.playerHand)}
Your value: ${game.getHandValue(game.playerHand)}
    `;
  }

  getFinalGameState(game) {
    return `
🎰 Blackjack 🎰
Dealer's hand: ${game.formatHand(game.dealerHand)}
Dealer's value: ${game.getHandValue(game.dealerHand)}

Your hand: ${game.formatHand(game.playerHand)}
Your value: ${game.getHandValue(game.playerHand)}
    `;
  }

  determineWinner(game) {
    const playerValue = game.getHandValue(game.playerHand);
    const dealerValue = game.getHandValue(game.dealerHand);

    if (playerValue > 21) return 'bust';
    if (dealerValue > 21) return 'win';
    if (playerValue > dealerValue) return 'win';
    if (playerValue < dealerValue) return 'lose';
    return 'push';
  }

  async endGame(interaction, game, userId, result) {
    try {
      const gameData = games.get(userId);
      if (!gameData) return;

      const bet = gameData.bet;
      let winnings = 0;

      if (result === 'win') {
        winnings = bet * 2;
        await prisma.user.update({
          where: { id: userId },
          data: {
            wallet: { increment: winnings },
            totalWon: { increment: winnings - bet }
          }
        });
      } else if (result === 'push') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            wallet: { increment: bet }
          }
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalLost: { increment: bet }
          }
        });
      }

      const resultMessage = `
${this.getFinalGameState(game)}
${result === 'win' ? `You won $${winnings}!` : 
  result === 'push' ? 'Push! Your bet has been returned.' : 
  'You lost!'}
      `;

      await interaction.update({
        content: resultMessage,
        components: []
      });

      games.delete(userId);
    } catch (error) {
      console.error('Error in endGame:', error);
      try {
        await interaction.update({
          content: 'An error occurred while ending the game.',
          components: []
        });
      } catch (updateError) {
        console.error('Error updating end game message:', updateError);
      }
      games.delete(userId);
    }
  }
}