import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

export class TransferCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'transfer',
      description: 'Transfer money between bank and wallet',
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Transfer type')
            .setRequired(true)
            .addChoices(
              { name: 'Wallet to Bank', value: 'toBank' },
              { name: 'Bank to Wallet', value: 'toWallet' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to transfer')
            .setRequired(true)
            .setMinValue(1)
        )
    );
  }

  async chatInputRun(interaction) {
    try {
      // Restrict command to the banking channel
      if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
        return interaction.reply({
          content: '⚠️ This command can only be used in the banking channel!',
          ephemeral: true,
        });
      }

      // Defer the reply ephemerally
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount');

      // Get or create user automatically
      let user = await prisma.user.findUnique({
        where: { id: interaction.user.id },
      });

      // Auto-register if user doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: interaction.user.id,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0,
          },
        });
      }

      if (type === 'toBank') {
        if (user.wallet < amount) {
          return interaction.editReply({
            content: `❌ Insufficient funds in wallet! You have $${user.wallet}`,
          });
        }

        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            wallet: { decrement: amount },
            bank: { increment: amount },
          },
        });

        return interaction.editReply({
          content: `
✅ Transfer Successful!
Transferred $${amount} to bank.
**New Wallet Balance:** $${updatedUser.wallet}
**New Bank Balance:** $${updatedUser.bank}
          `,
        });
      } else if (type === 'toWallet') {
        if (user.bank < amount) {
          return interaction.editReply({
            content: `❌ Insufficient funds in bank! You have $${user.bank}`,
          });
        }

        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            bank: { decrement: amount },
            wallet: { increment: amount },
          },
        });

        return interaction.editReply({
          content: `
✅ Transfer Successful!
Transferred $${amount} to wallet.
**New Wallet Balance:** $${updatedUser.wallet}
**New Bank Balance:** $${updatedUser.bank}
          `,
        });
      }
    } catch (error) {
      console.error('Transfer command error:', error);
      return interaction.editReply({
        content: '❌ An error occurred while processing your transfer. Please try again.',
      });
    }
  }
}
