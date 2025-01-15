import { GamblingCommand } from '../../lib/structures/GamblingCommand';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
class Deck {
    cards;
    constructor() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const value of VALUES) {
                this.cards.push({ suit, value });
            }
        }
        this.shuffle();
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    draw() {
        return this.cards.pop();
    }
}
function calculateHand(hand) {
    let value = 0;
    let aces = 0;
    for (const card of hand) {
        if (card.value === 'A') {
            aces++;
        }
        else if (['K', 'Q', 'J'].includes(card.value)) {
            value += 10;
        }
        else {
            value += parseInt(card.value);
        }
    }
    for (let i = 0; i < aces; i++) {
        if (value + 11 <= 21) {
            value += 11;
        }
        else {
            value += 1;
        }
    }
    return value;
}
export class BlackjackCommand extends GamblingCommand {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'blackjack',
            description: 'Play blackjack against the dealer'
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
        const deck = new Deck();
        const playerHand = [deck.draw(), deck.draw()];
        const dealerHand = [deck.draw(), deck.draw()];
        const playerValue = calculateHand(playerHand);
        const dealerValue = calculateHand(dealerHand);
        let winnings = 0;
        if (playerValue === 21) {
            winnings = bet * 2.5; // Blackjack pays 3:2
        }
        else if (dealerValue === 21) {
            winnings = 0;
        }
        else if (playerValue > dealerValue) {
            winnings = bet * 2;
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
            .setTitle('♠️ Blackjack')
            .addFields({ name: 'Your Hand', value: playerHand.map(c => `${c.value}${c.suit}`).join(' '), inline: true }, { name: 'Dealer\'s Hand', value: dealerHand.map(c => `${c.value}${c.suit}`).join(' '), inline: true }, { name: 'Bet', value: `$${bet.toFixed(2)}`, inline: true }, { name: 'Winnings', value: `$${winnings.toFixed(2)}`, inline: true })
            .setColor(winnings > 0 ? '#00ff00' : '#ff0000');
        return message.reply({ embeds: [embed] });
    }
}
