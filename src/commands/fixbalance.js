import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import ROLE_IDS from '../config/roleIds.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';
 
export class FixBalanceCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'fixbalance',
      description: 'Admin command to fix user balance'
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
            .setDescription('User to fix balance for')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('bank')
            .setDescription('New bank balance')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('wallet')
            .setDescription('New wallet balance')
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
      if (!interaction.member.roles.cache.has(ROLE_IDS.ADMIN)) {
        return interaction.reply({
          content: '❌ Only administrators can use this command!',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser('user');
      const newBank = interaction.options.getInteger('bank');
      const newWallet = interaction.options.getInteger('wallet');

      // Get or create user automatically
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

      const updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          bank: newBank,
          wallet: newWallet
        }
      });

      return interaction.editReply({
        content: `✅ Balance Fixed for ${targetUser.username}!\nNew Bank Balance: $${updatedUser.bank}\nNew Wallet Balance: $${updatedUser.wallet}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error in fixbalance command:', error);
      if (!interaction.deferred) {
        return interaction.reply({
          content: '❌ Error fixing balance. Please try again.',
          ephemeral: true
        });
      }
      return interaction.editReply({
        content: '❌ Error fixing balance. Please try again.',
        ephemeral: true
      });
    }
  }
}