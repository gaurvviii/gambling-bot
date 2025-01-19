import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

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
    // Check if user is admin
    if (!interaction.member.permissions.has('ADMIN')) {
      return interaction.reply({
        content: '❌ Only administrators can use this command!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const newBank = interaction.options.getInteger('bank');
    const newWallet = interaction.options.getInteger('wallet');

    try {
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
      return interaction.reply('❌ Error fixing balance. Make sure the user is registered.');
    }
  }
} 