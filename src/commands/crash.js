import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

const games = new Map();

export class CrashCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'crash',
      description: 'Play crash game - bet and cash out before it crashes!'
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
    // Check if command is used in gambling channel
    if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
      return interaction.reply({
        content: '⚠️ This command can only be used in the gambling channel!',
        ephemeral: true
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;
      if (games.has(userId)) {
        return interaction.editReply('You already have a game in progress!');
      }

      const bet = interaction.options.getInteger('bet');

      // Get or create user automatically
      let user = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Auto-register if user doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0
          }
        });
      }

      if (user.wallet < bet) {
        return interaction.editReply('Insufficient funds in wallet!');
      }

      // Deduct bet using Prisma transaction
      await prisma.user.update({
        where: { id: userId },
        data: {
          wallet: { decrement: bet }
        }
      });

      const crashPoint = this.generateCrashPoint();
      let multiplier = 1.0;
      let gameInterval;
      let hasEnded = false;

      const cashoutButton = new ButtonBuilder()
        .setCustomId('cashout')
        .setLabel('Cash Out')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(cashoutButton);

      const response = await interaction.editReply({
        content: this.getGameState(multiplier),
        components: [row]
      });

      const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === userId && !hasEnded,
        time: 20000
      });

      games.set(userId, {
        bet,
        crashPoint,
        active: true
      });

      gameInterval = setInterval(async () => {
        try {
          if (hasEnded) {
            clearInterval(gameInterval);
            return;
          }

          multiplier += 0.1;
          if (multiplier >= crashPoint) {
            clearInterval(gameInterval);
            hasEnded = true;
            collector.stop('crash');
            await this.endGame(interaction, userId, 0, multiplier);
          } else {
            await interaction.editReply({
              content: this.getGameState(multiplier),
              components: [row]
            });
          }
        } catch (error) {
          console.error('Error in game interval:', error);
          clearInterval(gameInterval);
          hasEnded = true;
          collector.stop('error');
          games.delete(userId);
        }
      }, 1000);

      collector.on('collect', async (i) => {
        try {
          if (i.customId === 'cashout' && !hasEnded) {
            hasEnded = true;
            clearInterval(gameInterval);
            const winnings = Math.floor(bet * multiplier);
            await this.endGame(interaction, userId, winnings, multiplier);
            collector.stop('cashout');
          }
        } catch (error) {
          console.error('Error in collector:', error);
          hasEnded = true;
          clearInterval(gameInterval);
          collector.stop('error');
          games.delete(userId);
          await i.update({
            content: 'An error occurred while processing your cashout.',
            components: []
          });
        }
      });

      collector.on('end', async (collected, reason) => {
        try {
          if (reason === 'crash' && !hasEnded) {
            await interaction.editReply({
              content: `💥 Crashed at ${crashPoint.toFixed(1)}x!\nYou lost $${bet}!`,
              components: []
            });
          } else if (reason === 'error') {
            await interaction.editReply({
              content: 'An error occurred during the game. Your bet has been refunded.',
              components: []
            });
            // Refund the bet
            await prisma.user.update({
              where: { id: userId },
              data: {
                wallet: { increment: bet }
              }
            });
          }
          games.delete(userId);
        } catch (error) {
          console.error('Error in collector end:', error);
        }
      });
    } catch (error) {
      console.error('Error in chatInputRun:', error);
      try {
        const response = interaction.deferred ? 
          await interaction.editReply('An error occurred while starting the game.') :
          await interaction.reply('An error occurred while starting the game.');
        return response;
      } catch (replyError) {
        console.error('Error sending error message:', replyError);
      }
    }
  }

  generateCrashPoint() {
    return Math.max(1.0, (Math.random() * 2 + 1) * (Math.random() * 2 + 1));
  }

  getGameState(multiplier) {
    return `
🚀 Crash Game 🚀
Current Multiplier: ${multiplier.toFixed(1)}x
    `;
  }

  async endGame(interaction, userId, winnings, finalMultiplier) {
    try {
      const game = games.get(userId);
      if (!game) return;
      
      games.delete(userId);

      if (winnings > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            wallet: { increment: winnings },
            totalWon: { increment: winnings - game.bet }
          }
        });

        await interaction.editReply({
          content: `
🎉 Cashed out at ${finalMultiplier.toFixed(1)}x!
You won $${winnings}!`,
          components: []
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalLost: { increment: game.bet }
          }
        });
      }
    } catch (error) {
      console.error('Error in endGame:', error);
      await interaction.editReply({
        content: 'An error occurred while ending the game.',
        components: []
      });
    }
  }
}