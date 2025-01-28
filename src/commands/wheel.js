import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

const WHEEL_SEGMENTS = [
  { multiplier: 0.5, emoji: '💰' },
  { multiplier: 1.5, emoji: '💎' },
  { multiplier: 2.0, emoji: '🌟' },
  { multiplier: 0.0, emoji: '💀' }, // Loss
  { multiplier: 0.0, emoji: '💀' }, // Loss
  { multiplier: 0.0, emoji: '💀' }, // Loss
  { multiplier: 0.0, emoji: '💀' }, // Loss
];

export class WheelCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'wheel',
      description: 'Spin the Wheel of Fortune'
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
      // Restrict command to the banking channel
      if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
        return interaction.reply({
          content: '⚠️ This command can only be used in the banking channel!',
          ephemeral: true,
        });
      }

      // Defer the reply immediately to prevent interaction timeout
      await interaction.deferReply({ ephemeral: true });

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

      if (user.wallet < bet) {
        return interaction.editReply('Insufficient funds in wallet!');
      }

      // Deduct bet
      await prisma.user.update({
        where: { id: user.id },
        data: {
          wallet: { decrement: bet }
        }
      });

      // Animation frames
      const frames = ['🎡 Spinning...', '🎰 Spinning..', '🎲 Spinning...'];
      for (let i = 0; i < 3; i++) {
        await interaction.editReply(frames[i]);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Determine result (completely random)
      const result = WHEEL_SEGMENTS[Math.floor(Math.random() * WHEEL_SEGMENTS.length)];
      const winnings = Math.floor(bet * result.multiplier);

      // Update user's balance
      if (winnings > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            wallet: { increment: winnings },
            totalWon: { increment: winnings - bet }
          }
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            totalLost: { increment: bet }
          }
        });
      }

      return interaction.editReply(`
🎡 Wheel of Fortune 🎡
Landed on: ${result.emoji}
Multiplier: ${result.multiplier}x
${winnings > 0 ? `You won $${winnings}!` : 'You lost!'}
      `);
    } catch (error) {
      console.error('Wheel command error:', error);
      return interaction.editReply('❌ An error occurred while processing your spin. Please try again.');
    }
  }
}
