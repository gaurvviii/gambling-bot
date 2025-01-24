import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

export class SlotsCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'slots',
      description: 'Play slots! Bet an amount and try your luck'
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
      // Restrict command to the gambling channel
      if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
        return interaction.reply({
          content: '⚠️ This command can only be used in the gambling channel!',
          ephemeral: true,
        });
      }

      // Defer the reply
      await interaction.deferReply({ephemeral: true});

      const bet = interaction.options.getInteger('bet');
      
      // Get or create user automatically
      let user = await prisma.user.findUnique({
        where: { id: interaction.user.id }
      });

      // Auto-register if user doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: interaction.user.id,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0
          }
        });
      }

      if (bet > user.wallet) {
        return interaction.editReply('Insufficient funds in wallet!');
      }

      // Deduct bet first
      await prisma.user.update({
        where: { id: interaction.user.id },
        data: {
          wallet: { decrement: bet }
        }
      });

      const symbols = ['🍒', '🍊', '🍋', '🍇', '💎', '7️⃣'];
      const result = Array(3)
        .fill(0)
        .map(() => symbols[Math.floor(Math.random() * symbols.length)]);

      let winnings = 0;
      if (result[0] === result[1] && result[1] === result[2]) {
        winnings = bet * 5;
      } else if (result[0] === result[1] || result[1] === result[2]) {
        winnings = bet * 2;
      }

      // Update balance based on result
      if (winnings > 0) {
        await prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            wallet: { increment: winnings },
            totalWon: { increment: winnings - bet }
          }
        });
      } else {
        await prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            totalLost: { increment: bet }
          }
        });
      }

      const resultMessage = `
🎰 SLOTS 🎰
═══════════
║ ${result.join(' | ')} ║
═══════════
${winnings > 0 ? `You won $${winnings}!` : 'You lost!'}`;

      return interaction.editReply(resultMessage);
    } catch (error) {
      console.error('Error in slots command:', error);
      return interaction.editReply('An error occurred while processing your game. Please try again.');
    }
  }
}
