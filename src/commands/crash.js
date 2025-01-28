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

  generateCrashPoint() {
    // Generate crash point between 1 and 6
    return Math.min(6.00, Math.max(1.00, (Math.random() * 5) + 1));
  }

  getGameState(multiplier) {
    return `
🚀 Crash Game 🚀
Current Multiplier: ${multiplier.toFixed(2)}x
    `;
  }

  async chatInputRun(interaction) {
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

      let user = await prisma.user.findUnique({
        where: { id: userId }
      });

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

      await prisma.user.update({
        where: { id: userId },
        data: {
          wallet: { decrement: bet }
        }
      });

      const crashPoint = this.generateCrashPoint();
      let multiplier = 1.00;
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
        filter: (i) => i.user.id === userId && !hasEnded,
      });

      games.set(userId, {
        bet,
        crashPoint,
        active: true
      });

      let gameInterval = setInterval(async () => {
        try {
          if (hasEnded) {
            clearInterval(gameInterval);
            return;
          }

          multiplier += 0.1;
          
          if (multiplier >= crashPoint) {
            clearInterval(gameInterval);
            hasEnded = true;
            await interaction.editReply({
              content: null,
              embeds: [{
                title: "💥 CRASHED!",
                description: `The game crashed at **${crashPoint.toFixed(2)}x**\nYou lost **$${bet}**!`,
                color: 0xFF0000
              }],
              components: []
            });
            
            await prisma.user.update({
              where: { id: userId },
              data: {
                totalLost: { increment: bet }
              }
            });
            
            collector.stop('crash');
            games.delete(userId);
            return;
          }

          await interaction.editReply({
            content: this.getGameState(multiplier),
            components: [row]
          });
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
            await interaction.editReply({
              content: `🎉 Cashed out at ${multiplier.toFixed(2)}x!\nYou won $${winnings}!`,
              components: []
            });
            await prisma.user.update({
              where: { id: userId },
              data: {
                wallet: { increment: winnings }
              }
            });
            collector.stop('cashout');
            games.delete(userId);
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
          const game = games.get(userId);
          if (!game) return;

          if (!hasEnded) {
            hasEnded = true;
            clearInterval(gameInterval);
            
            if (reason === 'crash') {
              await interaction.editReply({
                content: null,
                embeds: [{
                  title: "💥 CRASHED!",
                  description: `The game crashed at **${crashPoint.toFixed(2)}x**\nYou lost **$${game.bet}**!`,
                  color: 0xFF0000
                }],
                components: []
              });
            } else if (reason === 'max') {
              await interaction.editReply({
                content: `🎉 Maximum multiplier reached! (6.00x)\nYou won $${Math.floor(bet * 6)}!`,
                components: []
              });
              await prisma.user.update({
                where: { id: userId },
                data: {
                  wallet: { increment: bet }
                }
              });
            }
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

  async endGame(interaction, userId, winnings, finalMultiplier, crashPoint) {
    try {
      const game = games.get(userId);
      if (!game) return;

      if (winnings > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            wallet: { increment: Math.floor(winnings) }
          }
        });

        await interaction.editReply({
          content: `
🎉 Cashed out at ${finalMultiplier.toFixed(2)}x!
You won $${Math.floor(winnings)}!`,
          components: []
        });
      } else {
        await interaction.editReply({
          content: null,
          embeds: [{
            title: "💥 CRASHED!",
            description: `The game crashed at **${crashPoint.toFixed(2)}x**\nYou lost **$${game.bet}**!`,
            color: 0xFF0000
          }],
          components: []
        });
        
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
