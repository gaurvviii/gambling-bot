import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class BalanceCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'balance',
      description: 'Check your wallet and bank balance'
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
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (!user) {
      return interaction.reply('You need to create an account first!');
    }

    return interaction.reply(`
💰 Your Balance 💰
Wallet: $${user.wallet}
Bank: $${user.bank}
Total: $${user.wallet + user.bank}
    `);
  }
} 