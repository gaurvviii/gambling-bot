import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class TransferCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'transfer',
      description: 'Transfer money between bank and wallet'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Transfer type')
            .setRequired(true)
            .addChoices(
              { name: 'Wallet to Bank', value: 'toBank' },
              { name: 'Bank to Wallet', value: 'toWallet' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount to transfer')
            .setRequired(true)
            .setMinValue(1)
        )
    );
  }

  async chatInputRun(interaction) {
    const type = interaction.options.getString('type');
    const amount = interaction.options.getInteger('amount');
    
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (!user) {
      return interaction.reply({
        content: 'You need to register first!',
        ephemeral: true,
      });
    }

    if (type === 'toBank') {
      if (user.wallet < amount) {
        return interaction.reply(`❌ Insufficient funds in wallet! You have $${user.wallet}`);
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          wallet: { decrement: amount },
          bank: { increment: amount }
        }
      });

      return interaction.reply(`
✅ Transfer Successful!
Transferred $${amount} to bank
New Wallet Balance: $${updatedUser.wallet}
New Bank Balance: $${updatedUser.bank}
      `);

    } else if (type === 'toWallet') {
      if (user.bank < amount) {
        return interaction.reply(`❌ Insufficient funds in bank! You have $${user.bank}`);
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          bank: { decrement: amount },
          wallet: { increment: amount }
        }
      });

      return interaction.reply(`
✅ Transfer Successful!
Transferred $${amount} to wallet
New Wallet Balance: $${updatedUser.wallet}
New Bank Balance: $${updatedUser.bank}
      `);
    }
  }
} 