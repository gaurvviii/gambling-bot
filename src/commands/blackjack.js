import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BlackjackGame } from '../lib/games/blackjackGame.js';
import { getUser, updateBalance } from '../lib/database.js';

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
    const userId = interaction.user.id;
    if (games.has(userId)) {
      return interaction.reply('You already have a game in progress!');
    }

    const bet = interaction.options.getInteger('bet');
    const user = await getUser(userId);

    if (user.balance < bet) {
      return interaction.reply('Insufficient funds!');
    }

    // Deduct bet amount
    await updateBalance(userId, -bet);

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

    const response = await interaction.reply({
      content: this.getGameState(game),
      components: [buttons]
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== userId) {
        return i.reply({ content: 'This is not your game!', ephemeral: true });
      }

      const gameData = games.get(userId);
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
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          content: 'Game expired due to inactivity!',
          components: []
        });
        games.delete(userId);
      }
    });
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
    const gameData = games.get(userId);
    const bet = gameData.bet;
    let winnings = 0;

    // Update total won/lost statistics
    if (result === 'win') {
      winnings = bet * 2;
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalWon: { increment: winnings - bet }
        }
      });
    } else if (result === 'lose' || result === 'bust') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalLost: { increment: bet }
        }
      });
    }

    if (winnings > 0) {
      await updateBalance(userId, winnings);
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
  }
} 