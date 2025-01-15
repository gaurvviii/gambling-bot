import { Command } from '@sapphire/framework';

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

    const resultMessage = `
🎰 SLOTS 🎰
═══════════
║ ${result.join(' | ')} ║
═══════════
${winnings > 0 ? `You won $${winnings}!` : 'You lost!'}`;

    await interaction.reply(resultMessage);
  }
} 