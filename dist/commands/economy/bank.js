import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class BankCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'bank',
            description: 'Deposit or withdraw money from your bank'
        });
    }
    async messageRun(message, args) {
        const action = await args.pick('string').catch(() => '');
        const amount = await args.pick('number').catch(() => 0);
        if (!['deposit', 'withdraw'].includes(action.toLowerCase()) || amount <= 0) {
            return message.reply('Please specify a valid action (deposit/withdraw) and amount!');
        }
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        if (!user) {
            return message.reply('You don\'t have an account yet!');
        }
        if (action === 'deposit' && user.wallet < amount) {
            return message.reply('You don\'t have enough money in your wallet!');
        }
        if (action === 'withdraw' && user.bank < amount) {
            return message.reply('You don\'t have enough money in your bank!');
        }
        const updatedUser = await prisma.user.update({
            where: { id: message.author.id },
            data: {
                wallet: action === 'deposit'
                    ? { decrement: amount }
                    : { increment: amount },
                bank: action === 'deposit'
                    ? { increment: amount }
                    : { decrement: amount }
            }
        });
        const embed = new EmbedBuilder()
            .setTitle('🏦 Bank Transaction')
            .setDescription(`Successfully ${action}ed $${amount.toFixed(2)}`)
            .addFields({ name: 'Wallet Balance', value: `$${updatedUser.wallet.toFixed(2)}`, inline: true }, { name: 'Bank Balance', value: `$${updatedUser.bank.toFixed(2)}`, inline: true })
            .setColor('#00ff00');
        return message.reply({ embeds: [embed] });
    }
}
