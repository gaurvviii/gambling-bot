import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import ROLE_IDS from '../config/roleIds.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

export class CheckBalanceCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'checkbalance',
      description: 'Admin command to check user balance'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check balance for')
            .setRequired(true)
        )
    );
  }

  async chatInputRun(interaction) {
    try {
      // Check if command is used in gambling channel
      if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
        return interaction.reply({
          content: '⚠️ This command can only be used in the gambling channel!',
          ephemeral: true
        });
      }

      // Check if user has admin role
      if (!interaction.member.roles.cache.has(ROLE_IDS.OWNER)) {
        return interaction.reply({
          content: '❌ Only administrators can use this command!',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser('user');

      // Fetch user balance from the database
      let user = await prisma.user.findUnique({
        where: { id: targetUser.id }
      });

      // Auto-register if user doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: targetUser.id,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0
          }
        });
      }

      return interaction.editReply({
        content: `✅ Balance for ${targetUser.username}:
Bank Balance: $${user.bank}
Wallet Balance: $${user.wallet}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error in checkbalance command:', error);
      if (!interaction.deferred) {
        return interaction.reply({
          content: '❌ Error fetching balance. Please try again.',
          ephemeral: true
        });
      }
      return interaction.editReply({
        content: '❌ Error fetching balance. Please try again.',
        ephemeral: true
      });
    }
  }
}
