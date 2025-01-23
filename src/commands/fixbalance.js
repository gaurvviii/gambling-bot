import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import ROLE_IDS from '../config/roleIds.js';

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
    // Check if user has admin role
    if (!interaction.member.roles.cache.has(ROLE_IDS.ADMIN)) {
      return interaction.reply({
        content: '❌ Only administrators can use this command!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const newBank = interaction.options.getInteger('bank');
    const newWallet = interaction.options.getInteger('wallet');

    try {
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

      return interaction.reply(`
✅ Balance Fixed for ${targetUser.username}!
New Bank Balance: $${updatedUser.bank}
New Wallet Balance: $${updatedUser.wallet}
      `);
    } catch (error) {
      console.error('Error in fixbalance command:', error);
      return interaction.reply('❌ Error fixing balance. Please try again.');
    }
  }
}