import { Command } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import ROLE_IDS from '../config/roleIds.js'; 

const prisma = new PrismaClient();

export class LotteryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'lottery',
            description: 'Manage lotteries',
            preconditions: ['GuildOnly'],
            subcommands: [
                { name: 'create', chatInputRun: 'createLottery' },
                { name: 'buy', chatInputRun: 'buyTicket' },
                { name: 'info', chatInputRun: 'showLotteryInfo' }
            ]
        });
    }

    async createLottery(interaction) {
        // Check if the user has the 'ADMIN' role using the imported ROLE_IDS object
        if (!interaction.member.roles.cache.has(ROLE_IDS.ADMIN)) {
            return interaction.reply('You do not have permission to create a lottery.');
        }

        const prize = interaction.options.getInteger('prize', true);
        const ticketPrice = interaction.options.getInteger('ticket_price', true);
        const duration = interaction.options.getInteger('duration', true);

        const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);

        const lottery = await prisma.lottery.create({
            data: {
                prize,
                ticketPrice,
                endTime,
                isActive: true
            }
        });

        interaction.reply(`Lottery created!\nID: ${lottery.id}\nPrize: ${prize}\nTicket Price: ${ticketPrice}\nDuration: ${duration} hours.`);

        this.scheduleLotteryDraw(lottery.id, endTime);
    }

    async buyTicket(interaction) {
        const lotteryId = interaction.options.getInteger('lottery_id', true);
        const ticketCount = interaction.options.getInteger('ticket_count', true);
        const userId = interaction.user.id;

        const lottery = await prisma.lottery.findUnique({ where: { id: lotteryId } });

        if (!lottery || !lottery.isActive) {
            return interaction.reply('This lottery is not active or does not exist.');
        }

        const user = await prisma.user.findUnique({ where: { discordId: userId } });

        if (!user) {
            return interaction.reply('You do not have an account.');
        }

        const totalCost = lottery.ticketPrice * ticketCount;

        if (user.wallet < totalCost) {
            return interaction.reply('You do not have enough funds to purchase these tickets.');
        }

        // Optionally, allow users to opt-in for notifications
        if (interaction.options.getBoolean('notifications')) {
            await prisma.user.update({
                where: { discordId: userId },
                data: { wantsNotifications: true }
            });
        }

        await prisma.user.update({
            where: { discordId: userId },
            data: { wallet: { decrement: totalCost } }
        });

        const tickets = Array.from({ length: ticketCount }, () => ({
            lotteryId: lottery.id,
            userId: user.id
        }));

        await prisma.ticket.createMany({ data: tickets });

        interaction.reply(`You purchased ${ticketCount} ticket(s) for lottery ID ${lottery.id}.`);
    }

    async showLotteryInfo(interaction) {
        const lotteryId = interaction.options.getInteger('lottery_id', true);

        const lottery = await prisma.lottery.findUnique({
            where: { id: lotteryId },
            include: { tickets: true }
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

        interaction.reply({ embeds: [embed] });
    }

    async scheduleLotteryDraw(lotteryId, endTime) {
        const delay = Math.max(0, endTime.getTime() - Date.now());

        setTimeout(async () => {
            const lottery = await prisma.lottery.findUnique({
                where: { id: lotteryId },
                include: { tickets: true }
            });

            if (!lottery || !lottery.isActive || lottery.tickets.length === 0) {
                await prisma.lottery.update({ where: { id: lotteryId }, data: { isActive: false } });
                return;
            }

            const winnerIndex = Math.floor(Math.random() * lottery.tickets.length);
            const winnerTicket = lottery.tickets[winnerIndex];
            const winner = await prisma.user.findUnique({ where: { id: winnerTicket.userId } });

            await prisma.user.update({
                where: { id: winner.id },
                data: { wallet: { increment: lottery.prize } }
            });

            await prisma.lottery.update({ where: { id: lotteryId }, data: { isActive: false } });

            // Notify the winner via DM if they opted-in for notifications
            if (winner.wantsNotifications) {
                try {
                    const user = await this.container.client.users.fetch(winner.discordId);
                    user.send(`Congratulations! You've won the lottery ID ${lottery.id} and received a prize of ${lottery.prize}!`);
                } catch (error) {
                    console.error('Failed to send DM to the winner:', error);
                }
            }

            this.container.client.channels.cache.get('your-channel-id').send(
                `The lottery ID ${lottery.id} has ended!\nWinner: <@${winner.discordId}>\nPrize: ${lottery.prize}`
            );
        }, delay);
    }
}
