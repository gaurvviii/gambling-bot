import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0-36
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export class RouletteCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'roulette',
      description: 'Play roulette'
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
            .setName('type')
            .setDescription('Type of bet')
            .setRequired(true)
            .addChoices(
              { name: 'Number (35:1)', value: 'number' },
              { name: 'Red/Black (1:1)', value: 'color' },
              { name: 'Even/Odd (1:1)', value: 'parity' },
              { name: '1-18/19-36 (1:1)', value: 'half' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('choice')
            .setDescription('Your choice (number 0-36, red/black, even/odd, or 1-18/19-36)')
            .setRequired(true)
        )
    );
  }

  async chatInputRun(interaction) {
    const userId = interaction.user.id;
    
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
    
    const bet = interaction.options.getInteger('bet');
    const type = interaction.options.getString('type');
    const choice = interaction.options.getString('choice').toLowerCase();

    if (bet > user.wallet) {
      return interaction.reply('Insufficient funds in wallet!');
    }

    const result = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];
    let won = false;
    let multiplier = 0;

    switch (type) {
      case 'number':
        const chosenNumber = parseInt(choice);
        if (isNaN(chosenNumber) || chosenNumber < 0 || chosenNumber > 36) {
          return interaction.reply('Invalid number! Choose 0-36');
        }
        won = result === chosenNumber;
        multiplier = 35;
        break;

      case 'color':
        if (!['red', 'black'].includes(choice)) {
          return interaction.reply('Invalid color! Choose red or black');
        }
        won = (choice === 'red' && RED_NUMBERS.includes(result)) ||
              (choice === 'black' && BLACK_NUMBERS.includes(result));
        multiplier = 1;
        break;

      case 'parity':
        if (!['even', 'odd'].includes(choice)) {
          return interaction.reply('Invalid choice! Choose even or odd');
        }
        if (result === 0) won = false;
        else won = (choice === 'even' && result % 2 === 0) ||
                  (choice === 'odd' && result % 2 === 1);
        multiplier = 1;
        break;

      case 'half':
        if (!['1-18', '19-36'].includes(choice)) {
          return interaction.reply('Invalid choice! Choose 1-18 or 19-36');
        }
        if (result === 0) won = false;
        else won = (choice === '1-18' && result <= 18) ||
                  (choice === '19-36' && result > 18);
        multiplier = 1;
        break;
    }

    const winnings = won ? bet * (multiplier + 1) : 0;
    const resultColor = RED_NUMBERS.includes(result) ? 'Red' : BLACK_NUMBERS.includes(result) ? 'Black' : 'Green';

    await prisma.user.update({
      where: { id: user.id },
      data: {
        wallet: { increment: winnings - bet },
        totalWon: { increment: won ? winnings - bet : 0 },
        totalLost: { increment: won ? 0 : bet }
      }
    });

    return interaction.reply(`
🎲 Roulette Result 🎲
Number: ${result} (${resultColor})
Your bet: ${bet} on ${choice}
${won ? `You won $${winnings}!` : 'You lost!'}
    `);
  }
}