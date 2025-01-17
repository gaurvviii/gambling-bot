import { Command } from '@sapphire/framework';
import { getUser } from '../lib/database.js';
import { prisma } from '../lib/database.js';
import ROLE_IDS from '../config/roleIds.js';
import { EmbedBuilder } from 'discord.js';

export class LotteryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'lottery',
            description: 'Manage lotteries in the server'
        });
    }

    async createLottery(interaction) {
        try {
            const member = interaction.member;

            // Check if the user has the admin role
            if (!member.roles.cache.has(ROLE_IDS.ADMIN)) {
                return interaction.reply('You do not have permission to create a lottery!');
            }

            const prize = interaction.options.getInteger('prize', true);
            const ticketPrice = interaction.options.getInteger('ticket_price', true);
            const duration = interaction.options.getInteger('duration', true);
            const endTime = new Date(Date.now() + duration * 3600000); // Duration in hours

            // Create the lottery
            const lottery = await prisma.lottery.create({
                data: {
                    prize,
                    ticketPrice,
                    endTime,
                    active: true,
                }
            });

            await interaction.reply(`Lottery created! ID: ${lottery.id}, Prize: $${prize}, Ticket Price: $${ticketPrice}`);
        } catch (error) {
            console.error('Error creating lottery:', error); // Log the error for debugging
            await interaction.reply('An error occurred while creating the lottery. Please try again later.');
        }
    }

    async showLotteryInfo(interaction) {
        try {
            const lotteryId = interaction.options.getInteger('lottery_id', true);

            const lottery = await prisma.lottery.findUnique({
                where: { id: lotteryId },
                include: { tickets: true } // Include tickets to get ticket information
            });

            if (!lottery) {
                return interaction.reply('This lottery does not exist.');
            }

            const timeRemaining = Math.max(0, (lottery.endTime.getTime() - Date.now()) / 1000);
            const userTickets = lottery.tickets.filter(ticket => ticket.userId === interaction.user.id).length;

            const embed = new EmbedBuilder()
                .setTitle(`Lottery ID: ${lottery.id}`)
                .addField('Prize Pool', `${lottery.prize}`, true)
                .addField('Ticket Price', `${lottery.ticketPrice}`, true)
                .addField('Tickets Sold', `${lottery.tickets.length}`, true)
                .addField('Time Remaining', `${Math.floor(timeRemaining / 3600)}h ${Math.floor((timeRemaining % 3600) / 60)}m`, true)
                .addField('Your Tickets', `${userTickets}`, true);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('An error occurred:', error);
            await interaction.reply('An error occurred while processing your request.');
        }
    }

    async buyTicket(interaction) {
        try {
            const lotteryId = interaction.options.getInteger('lottery_id', true);
            const userId = interaction.user.id;

            const lottery = await prisma.lottery.findUnique({
                where: { id: lotteryId },
                include: { tickets: true }
            });

            if (!lottery || !lottery.active) {
                return interaction.reply('This lottery does not exist or is no longer active.');
            }

            const user = await getUser(userId); // Retrieve user data
            if (user.wallet < lottery.ticketPrice) {
                return interaction.reply('Insufficient funds in wallet!');
            }

            // Deduct ticket price from user's wallet
            await prisma.user.update({
                where: { id: userId },
                data: {
                    wallet: { decrement: lottery.ticketPrice }
                }
            });

            // Create a new ticket
            const ticket = await prisma.lotteryTicket.create({
                data: {
                    userId: userId,
                    lotteryId: lotteryId
                }
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
    const currentTime = new Date();

    // Find all active lotteries that have expired
    const expiredLotteries = await prisma.lottery.findMany({
        where: {
            active: true,
            endTime: {
                lte: currentTime,
            },
        },
        include: {
            tickets: {
                select: {
                    userId: true,
                },
            },
        },
    });

    for (const lottery of expiredLotteries) {
        if (lottery.tickets.length === 0) {
            // If no tickets were sold, just deactivate the lottery
            await prisma.lottery.update({
                where: { id: lottery.id },
                data: { active: false },
            });
            continue;
        }

        // Randomly select a winner
        const winnerTicket = lottery.tickets[Math.floor(Math.random() * lottery.tickets.length)];

        // Update the lottery to inactive
        await prisma.lottery.update({
            where: { id: lottery.id },
            data: { active: false },
        });

        // Update the winner's wallet
        await prisma.user.update({
            where: { id: winnerTicket.userId },
            data: { wallet: { increment: lottery.prize } },
        });

        console.log(`🎉 Lottery Winner: <@${winnerTicket.userId}> has won $${lottery.prize} from lottery ID: ${lottery.id}!`);
    }
}

// Set an interval to check for expired lotteries every minute
setInterval(drawExpiredLotteries, 60000);
