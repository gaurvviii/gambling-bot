import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class BalanceCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'balance',
            description: 'Check your wallet and bank balance'
        });
    }
    async messageRun(message) {
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        if (!user) {
            return message.reply('You don\'t have an account yet! Your account will be created when you receive your first salary.');
        }
        const embed = new EmbedBuilder()
            .setTitle('💰 Balance')
            .setColor('#00ff00')
            .addFields({ name: 'Wallet', value: `$${user.wallet.toFixed(2)}`, inline: true }, { name: 'Bank', value: `$${user.bank.toFixed(2)}`, inline: true }, { name: 'Total', value: `$${(user.wallet + user.bank).toFixed(2)}`, inline: true });
        return message.reply({ embeds: [embed] });
    }
}
