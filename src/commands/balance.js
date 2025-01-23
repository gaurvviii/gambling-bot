import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

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
    await interaction.deferReply();

    try {
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

      return interaction.editReply(`💰 Your Balance 💰\nWallet: $${user.wallet}\nBank: $${user.bank}\nTotal: $${user.wallet + user.bank}`);
    } catch (error) {
      console.error('Error occurred in BalanceCommand:', error);
      return interaction.editReply('An error occurred while fetching your balance. Please try again later.');
    }
  }
}