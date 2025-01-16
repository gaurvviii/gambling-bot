import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class BankCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'bank',
      description: 'Manage your bank account'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand(subcommand =>
          subcommand
            .setName('withdraw')
            .setDescription('Withdraw money to your wallet')
            .addIntegerOption(option =>
              option
                .setName('amount')
                .setDescription('Amount to withdraw')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('deposit')
            .setDescription('Deposit money from your wallet')
            .addIntegerOption(option =>
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
    const subcommand = interaction.options.getSubcommand();
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (!user) {
      return interaction.reply('You need to create an account first!');
    }

    switch (subcommand) {
      case 'withdraw':
        const withdrawAmount = interaction.options.getInteger('amount');
        if (withdrawAmount > user.bank) {
          return interaction.reply('Insufficient funds in bank!');
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            bank: { decrement: withdrawAmount },
            wallet: { increment: withdrawAmount }
          }
        });

        return interaction.reply(`Successfully withdrew $${withdrawAmount.toFixed(2)} to your wallet!`);

      case 'deposit':
        const depositAmount = interaction.options.getInteger('amount');
        if (depositAmount > user.wallet) {
          return interaction.reply('Insufficient funds in wallet!');
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            wallet: { decrement: depositAmount },
            bank: { increment: depositAmount }
          }
        });

        return interaction.reply(`Successfully deposited $${depositAmount.toFixed(2)} to your bank!`);
    }
  }
}

// export class BankBalanceCommand extends Command {
//   constructor(context, options) {
//     super(context, {
//       ...options,
//       name: 'bankbalance', // or 'bank balance'
//       description: 'Check your bank balance'
//     });
//   }

//   async registerApplicationCommands(registry) {
//     registry.registerChatInputCommand((builder) =>
//       builder
//         .setName(this.name)
//         .setDescription(this.description)
//     );
//   }

//   async chatInputRun(interaction) {
//     const user = await prisma.user.findUnique({
//       where: { id: interaction.user.id }
//     });

//     if (!user) {
//       return interaction.reply('You need to register first! Use /register');
//     }

//     return interaction.reply(`Your bank balance is $${user.bank}`);
//   }
// }