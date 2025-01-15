import { GamblingCommand } from '../../lib/structures/GamblingCommand';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const SLOTS_SYMBOLS = ['🍒', '🍊', '🍋', '🍇', '💎', '7️⃣'];
const SLOTS_MULTIPLIERS = {
    '🍒': 2,
    '🍊': 3,
    '🍋': 4,
    '🍇': 5,
    '💎': 10,
    '7️⃣': 20
};
export class SlotsCommand extends GamblingCommand {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'slots',
            description: 'Play slots with your money'
        });
    }
    async messageRun(message, args) {
        const bet = await args.pick('number').catch(() => 0);
        if (bet <= 0) {
            return message.reply('Please specify a valid bet amount!');
        }
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        if (!user || user.wallet < bet) {
            return message.reply('You don\'t have enough money in your wallet!');
        }
        const slots = Array(3).fill(0).map(() => SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)]);
        let winnings = 0;
        if (slots[0] === slots[1] && slots[1] === slots[2]) {
            winnings = bet * SLOTS_MULTIPLIERS[slots[0]];
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
            .setTitle('🎰 Slots')
            .setDescription(`${slots.join(' | ')}`)
            .addFields({ name: 'Bet', value: `$${bet.toFixed(2)}`, inline: true }, { name: 'Winnings', value: `$${winnings.toFixed(2)}`, inline: true })
            .setColor(winnings > 0 ? '#00ff00' : '#ff0000');
        return message.reply({ embeds: [embed] });
    }
}
