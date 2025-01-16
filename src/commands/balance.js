import { Command } from '@sapphire/framework';
import { getUser } from '../lib/user.js';

export class BalanceCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'balance',
      description: 'Check your wallet balance'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
    );
  }

  async chatInputRun(interaction) {
    try {
      const user = await getUser(interaction.user.id);

      if (!user) {
        return interaction.reply('You need to register first! Use /register');
      }

      return interaction.reply(`💰 Your Balance 💰\nWallet: $${user.wallet}\nBank: $${user.bank}\nTotal: $${user.wallet + user.bank}`);
    } catch (error) {
      console.error('Error occurred in BalanceCommand:', error);
      return interaction.reply('An error occurred while fetching your balance. Please try again later.');
    }
  }
} 