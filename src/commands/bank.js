import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class BankCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'bank',
      description: 'Manage your bank account',
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
          subcommand
            .setName('withdraw')
            .setDescription('Withdraw money to your wallet')
            .addIntegerOption((option) =>
              option
                .setName('amount')
                .setDescription('Amount to withdraw')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('deposit')
            .setDescription('Deposit money from your wallet')
            .addIntegerOption((option) =>
              option
                .setName('amount')
                .setDescription('Amount to deposit')
                .setRequired(true)
                .setMinValue(1)
            )
        )
    );
  }

  async chatInputRun(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      // Get or create user automatically
      let user = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Auto-register if user doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0
          }
        });
      }

      if (subcommand === 'withdraw') {
        const withdrawAmount = interaction.options.getInteger('amount');

        if (withdrawAmount > user.bank) {
          return interaction.reply({
            content: 'Insufficient funds in bank!',
            ephemeral: true,
          });
        }

        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: {
              bank: { decrement: withdrawAmount },
              wallet: { increment: withdrawAmount },
            },
          }),
        ]);

        return interaction.reply({
          content: `Successfully withdrew $${withdrawAmount.toFixed(2)} to your wallet!`,
        });
      }

      if (subcommand === 'deposit') {
        const depositAmount = interaction.options.getInteger('amount');

        if (depositAmount > user.wallet) {
          return interaction.reply({
            content: 'Insufficient funds in wallet!',
            ephemeral: true,
          });
        }

        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: {
              wallet: { decrement: depositAmount },
              bank: { increment: depositAmount },
            },
          }),
        ]);

        return interaction.reply({
          content: `Successfully deposited $${depositAmount.toFixed(2)} to your bank!`,
        });
      }
    } catch (error) {
      console.error('Error in BankCommand:', error);
      return interaction.reply({
        content: 'An error occurred while processing your request. Please try again later.',
        ephemeral: true,
      });
    }
  }
}