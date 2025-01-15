import { GamblingCommand } from '../../lib/structures/GamblingCommand';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class CrashCommand extends GamblingCommand {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'crash',
            description: 'Play the crash game with your money'
        });
    }
    async messageRun(message, args) {
        const bet = await args.pick('number').catch(() => 0);
        const cashoutMultiplier = await args.pick('number').catch(() => 0);
        if (bet <= 0 || cashoutMultiplier <= 1) {
            return message.reply('Please specify a valid bet amount and cashout multiplier (>1)!');
        }
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        if (!user || user.wallet < bet) {
            return message.reply('You don\'t have enough money in your wallet!');
        }
        // Calculate crash point using a random exponential distribution
        const crashPoint = Math.max(1, Math.pow(Math.random(), -1) / 1.5);
        let winnings = 0;
        if (crashPoint >= cashoutMultiplier) {
            winnings = bet * cashoutMultiplier;
        }
        await prisma.user.update({
            where: { id: message.author.id },
            data: {
                wallet: user.wallet - bet + winnings,
                totalGambled: { increment: bet },
                totalLost: { increment: winnings < bet ? bet - winnings : 0 }
            }
        });
        const embed = new EmbedBuilder()
            .setTitle('📈 Crash')
            .setDescription(`Crashed at ${crashPoint.toFixed(2)}x`)
            .addFields({ name: 'Bet', value: `$${bet.toFixed(2)}`, inline: true }, { name: 'Target Multiplier', value: `${cashoutMultiplier}x`, inline: true }, { name: 'Winnings', value: `$${winnings.toFixed(2)}`, inline: true })
            .setColor(winnings > 0 ? '#00ff00' : '#ff0000');
        return message.reply({ embeds: [embed] });
    }
}
