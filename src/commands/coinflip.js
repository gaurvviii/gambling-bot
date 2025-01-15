import { Command } from '@sapphire/framework';

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
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice === result;

    await interaction.reply(`
🎲 Coinflip Result 🎲
You chose: ${choice}
Result: ${result}
${won ? `You won $${bet * 2}!` : 'You lost!'}
    `);
  }
} 