import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

const WHEEL_SEGMENTS = [
  { multiplier: 2.0, chance: 30, emoji: '💰' },
  { multiplier: 3.0, chance: 20, emoji: '💎' },
  { multiplier: 5.0, chance: 10, emoji: '🌟' },
  { multiplier: 0.0, chance: 40, emoji: '💀' } // Loss
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
    await interaction.deferReply();

    const bet = interaction.options.getInteger('bet');
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });
    
    if (!user) {
      return interaction.reply({
        content: 'You need to register first!',
        ephemeral: true,
      });
    }
    if (!user || user.wallet < bet) {
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

    // Determine result
    const random = Math.random() * 100;
    let currentSum = 0;
    let result = WHEEL_SEGMENTS[WHEEL_SEGMENTS.length - 1];

    for (const segment of WHEEL_SEGMENTS) {
      currentSum += segment.chance;
      if (random <= currentSum) {
        result = segment;
        break;
      }
    }

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
  }
} 