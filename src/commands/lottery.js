import { Command } from '@sapphire/framework';
import { EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import { prisma } from '../lib/database.js'; 
import ROLE_IDS from '../config/roleIds.js';
import { getUser } from '../lib/user.js';
import { ApplicationCommandOptionType } from 'discord-api-types/v9';

export class LotteryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'lottery',
            description: 'Manage lotteries in the server',
            chatInputCommand: {
                register: true,
                behaviorWhenNotIdentical: 'overwrite',
            },
            options: [
                {
                    name: 'create',
                    description: 'Create a new lottery',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'prize', description: 'Prize amount', type: ApplicationCommandOptionType.Integer, required: true },
                        { name: 'ticket_price', description: 'Price of a ticket', type: ApplicationCommandOptionType.Integer, required: true },
                        { name: 'duration', description: 'Duration in hours', type: ApplicationCommandOptionType.Integer, required: true },
                    ],
                },
                {
                    name: 'info',
                    description: 'Get information about a lottery',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'lottery_id',
                            description: 'The ID of the lottery',
                            type: ApplicationCommandOptionType.Integer,
                            required: true,
                        },
                    ],
                },
                {
                    name: 'buy',
                    description: 'Buy a ticket for a lottery',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: 'lottery_id', description: 'ID of the lottery', type: ApplicationCommandOptionType.String, required: true },
                    ],
                },
            ],
        });
    }

    async chatInputRun(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'create') {
            await this.createLottery(interaction);
        } else if (subcommand === 'info') {
            await this.showLotteryInfo(interaction);
        } else if (subcommand === 'buy') {
            await this.buyTicket(interaction);
        }
    }

    // Create a new lottery
    async createLottery(interaction) {
        try {
            const member = interaction.member;

            if (!member.roles.cache.has(ROLE_IDS.ADMIN)) {
                return interaction.reply('You do not have permission to create a lottery!');
            }

            const prize = interaction.options.getInteger('prize', true);
            const ticketPrice = interaction.options.getInteger('ticket_price', true);
            const duration = interaction.options.getInteger('duration', true);
            const endTime = new Date(Date.now() + duration * 3600000); // Duration in hours

            const lottery = await prisma.lottery.create({
                data: {
                    prize,
                    ticketPrice,
                    endTime,
                    active: true,
                },
            });

            await interaction.reply(`Lottery created! ID: ${lottery.id}, Prize: $${prize}, Ticket Price: $${ticketPrice}`);
        } catch (error) {
            console.error('Error creating lottery:', error);
            await interaction.reply('An error occurred while creating the lottery. Please try again later.');
        }
    }

    // Show information about a lottery
    async showLotteryInfo(interaction) {
        try {
            const lotteryId = interaction.options.getString('lottery_id', true); // Get lottery_id as string

            const lottery = await prisma.lottery.findUnique({
                where: { id: lotteryId },
                include: { tickets: true }, // Include related tickets
            });

            if (!lottery) {
                return interaction.reply('This lottery does not exist.');
            }

            const timeRemaining = Math.max(0, (lottery.endTime.getTime() - Date.now()) / 1000);
            const userTickets = lottery.tickets.filter(ticket => ticket.userId === interaction.user.id).length;

            const embed = new EmbedBuilder()
                .setTitle(`Lottery ID: ${lottery.id}`)
                .addFields(
                    { name: 'Prize Pool', value: `$${lottery.prize}`, inline: true },
                    { name: 'Ticket Price', value: `$${lottery.ticketPrice}`, inline: true },
                    { name: 'Tickets Sold', value: `${lottery.tickets.length}`, inline: true },
                    { name: 'Time Remaining', value: `${Math.floor(timeRemaining / 3600)}h ${Math.floor((timeRemaining % 3600) / 60)}m`, inline: true },
                    { name: 'Your Tickets', value: `${userTickets}`, inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error showing lottery info:', error);
            await interaction.reply('An error occurred while fetching lottery information.');
        }
    }

    // Buy a ticket for a lottery
    async buyTicket(interaction) {
        try {
            const lotteryId = interaction.options.getString('lottery_id', true); // Get lottery_id as string
            const userId = interaction.user.id;

            const lottery = await prisma.lottery.findUnique({
                where: { id: lotteryId },
                include: { tickets: true },
            });

            if (!lottery || !lottery.active) {
                return interaction.reply('This lottery does not exist or is no longer active.');
            }

            const user = await getUser(userId);
            if (user.wallet < lottery.ticketPrice) {
                return interaction.reply('Insufficient funds in wallet!');
            }

            await prisma.user.update({
                where: { id: userId },
                data: { wallet: { decrement: lottery.ticketPrice } },
            });

            const ticket = await prisma.lotteryTicket.create({
                data: {
                    userId: userId,
                    lotteryId: lotteryId, // Connect to lottery_id in the database
                },
            });

            await interaction.reply(`You have successfully purchased a lottery ticket for lottery ID: ${lotteryId}! Ticket ID: ${ticket.id}`);
        } catch (error) {
            console.error('Error buying ticket:', error);
            await interaction.reply('An error occurred while purchasing your ticket. Please try again later.');
        }
    }
}

// Function to automatically draw winners for expired lotteries
async function drawExpiredLotteries() {
    try {
        const currentTime = new Date();

        const expiredLotteries = await prisma.lottery.findMany({
            where: {
                active: true,
                endTime: { lte: currentTime },
            },
            include: {
                tickets: { select: { userId: true } },
            },
        });

        for (const lottery of expiredLotteries) {
            if (lottery.tickets.length === 0) {
                await prisma.lottery.update({
                    where: { id: lottery.id },
                    data: { active: false },
                });
                continue;
            }

            const winnerTicket = lottery.tickets[Math.floor(Math.random() * lottery.tickets.length)];

            await prisma.lottery.update({
                where: { id: lottery.id },
                data: { active: false },
            });

            await prisma.user.update({
                where: { id: winnerTicket.userId },
                data: { wallet: { increment: lottery.prize } },
            });

            console.log(`🎉 Lottery Winner: <@${winnerTicket.userId}> has won $${lottery.prize} from lottery ID: ${lottery.id}!`);
        }
    } catch (error) {
        console.error('Error drawing expired lotteries:', error);
    }
}

// Check for expired lotteries every minute
setInterval(drawExpiredLotteries, 60000);
