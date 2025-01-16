import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class CoinflipCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'coinflip',
      description: 'Flip a coin and bet on heads or tails'
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
        .addStringOption((option) =>
          option
            .setName('choice')
            .setDescription('Choose heads or tails')
            .setRequired(true)
            .addChoices(
              { name: 'Heads', value: 'heads' },
              { name: 'Tails', value: 'tails' }
            )
        )
    );
  }

  async chatInputRun(interaction) {
    const bet = interaction.options.getInteger('bet');
    const choice = interaction.options.getString('choice');
    
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

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice === result;
    const winnings = won ? bet * 2 : 0;

    // Update balance based on result
    if (won) {
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

    await interaction.reply(`
🎲 Coinflip Result 🎲
You chose: ${choice}
Result: ${result}
${won ? `You won $${winnings}!` : 'You lost!'}
    `);
  }
}