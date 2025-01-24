import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

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
    // Check if command is used in gambling channel
    if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
      return interaction.reply({
        content: '⚠️ This command can only be used in the gambling channel!',
        ephemeral: true
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
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