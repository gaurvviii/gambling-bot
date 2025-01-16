import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

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
    const bet = interaction.options.getInteger('bet');
    
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (!user) {
      return interaction.reply('You need to create an account first!');
    }

    if (bet > user.wallet) {
      return interaction.reply('Insufficient funds in wallet!');
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

    await interaction.reply(resultMessage);
  }
}