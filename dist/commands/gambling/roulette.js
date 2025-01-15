import { GamblingCommand } from '../../lib/structures/GamblingCommand';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0-36
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export class RouletteCommand extends GamblingCommand {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'roulette',
            description: 'Play roulette with your money'
        });
    }
    async messageRun(message, args) {
        const bet = await args.pick('number').catch(() => 0);
        const betType = await args.pick('string').catch(() => '');
        if (bet <= 0 || !betType) {
            return message.reply('Please specify a valid bet amount and type (red/black/even/odd/number)!');
        }
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        if (!user || user.wallet < bet) {
            return message.reply('You don\'t have enough money in your wallet!');
        }
        const result = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];
        const isRed = RED_NUMBERS.includes(result);
        const isEven = result !== 0 && result % 2 === 0;
        let winnings = 0;
        if ((betType === 'red' && isRed) ||
            (betType === 'black' && !isRed) ||
            (betType === 'even' && isEven) ||
            (betType === 'odd' && !isEven)) {
            winnings = bet * 2;
        }
        else if (betType === result.toString()) {
            winnings = bet * 36;
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
            .setTitle('🎲 Roulette')
            .setDescription(`The ball landed on ${result} ${isRed ? '🔴' : '⚫'}`)
            .addFields({ name: 'Bet', value: `$${bet.toFixed(2)} on ${betType}`, inline: true }, { name: 'Winnings', value: `$${winnings.toFixed(2)}`, inline: true })
            .setColor(winnings > 0 ? '#00ff00' : '#ff0000');
        return message.reply({ embeds: [embed] });
    }
}
