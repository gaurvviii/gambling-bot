import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class TransferCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'transfer',
            description: 'Transfer money from your wallet to another user'
        });
    }
    async messageRun(message, args) {
        const amount = await args.pick('number').catch(() => 0);
        const target = await args.pick('user').catch(() => null);
        if (amount <= 0 || !target) {
            return message.reply('Please specify a valid amount and target user!');
        }
        const sender = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        if (!sender || sender.wallet < amount) {
            return message.reply('You don\'t have enough money in your wallet!');
        }
        await prisma.$transaction([
            prisma.user.update({
                where: { id: message.author.id },
                data: { wallet: { decrement: amount } }
            }),
            prisma.user.upsert({
                where: { id: target.id },
                create: {
                    id: target.id,
                    wallet: amount
                },
                update: {
                    wallet: { increment: amount }
                }
            })
        ]);
        const embed = new EmbedBuilder()
            .setTitle('💸 Money Transfer')
            .setDescription(`Successfully transferred $${amount.toFixed(2)} to ${target.username}`)
            .setColor('#00ff00');
        return message.reply({ embeds: [embed] });
    }
}
