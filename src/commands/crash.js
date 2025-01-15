import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '../lib/database.js';

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
    const userId = interaction.user.id;
    if (games.has(userId)) {
      return interaction.reply('You already have a game in progress!');
    }

    const bet = interaction.options.getInteger('bet');
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (bet > user.wallet) {
      return interaction.reply('Insufficient funds in wallet!');
    }

    // Deduct bet
    await prisma.user.update({
      where: { id: userId },
      data: {
        wallet: { decrement: bet }
      }
    });

    const crashPoint = this.generateCrashPoint();
    let multiplier = 1.0;
    let gameInterval;

    const cashoutButton = new ButtonBuilder()
      .setCustomId('cashout')
      .setLabel('Cash Out')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(cashoutButton);

    const response = await interaction.reply({
      content: this.getGameState(multiplier),
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 30000
    });

    games.set(userId, {
      bet,
      crashPoint,
      active: true
    });

    gameInterval = setInterval(async () => {
      multiplier += 0.1;
      if (multiplier >= crashPoint) {
        clearInterval(gameInterval);
        collector.stop('crash');
        await this.endGame(interaction, userId, 0);
      } else {
        await interaction.editReply({
          content: this.getGameState(multiplier),
          components: [row]
        });
      }
    }, 1000);

    collector.on('collect', async (i) => {
      if (i.customId === 'cashout') {
        clearInterval(gameInterval);
        const winnings = Math.floor(bet * multiplier);
        await this.endGame(interaction, userId, winnings);
        collector.stop();
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'crash') {
        await interaction.editReply({
          content: `💥 Crashed at ${crashPoint.toFixed(1)}x!\nYou lost $${bet}!`,
          components: []
        });
      }
    });
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

  async endGame(interaction, userId, winnings) {
    const game = games.get(userId);
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
🚀 Cashed out at ${(winnings / game.bet).toFixed(1)}x!
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
  }
} 