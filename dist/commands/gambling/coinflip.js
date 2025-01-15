import { GamblingCommand } from '../../lib/structures/GamblingCommand';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class CoinflipCommand extends GamblingCommand {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'coinflip',
            description: 'Flip a coin and bet on the outcome'
        });
    }
    async messageRun(message, args) {
        const bet = await args.pick('number').catch(() => 0);
        const choice = await args.pick('string').catch(() => '');
        if (bet <= 0 || !['heads', 'tails'].includes(choice.toLowerCase())) {
            return message.reply('Please specify a valid bet amount and choice (heads/tails)!');
        }
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        if (!user || user.wallet < bet) {
            return message.reply('You don\'t have enough money in your wallet!');
        }
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const winnings = result === choice.toLowerCase() ? bet * 2 : 0;
        await prisma.user.update({
            where: { id: message.author.id },
            data: {
                wallet: user.wallet - bet + winnings,
                totalGambled: { increment: bet },
                totalLost: { increment: winnings < bet ? bet - winnings : 0 }
            }
        });
        const embed = new EmbedBuilder()
            .setTitle('🪙 Coinflip')
            .setDescription(`The coin landed on ${result}!`)
            .addFields({ name: 'Your Choice', value: choice, inline: true }, { name: 'Bet', value: `$${bet.toFixed(2)}`, inline: true }, { name: 'Winnings', value: `$${winnings.toFixed(2)}`, inline: true })
            .setColor(winnings > 0 ? '#00ff00' : '#ff0000');
        return message.reply({ embeds: [embed] });
    }
}
