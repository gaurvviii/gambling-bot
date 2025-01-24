import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { prisma } from '../lib/database.js';
import ROLE_IDS from '../config/roleIds.js';
import { GAMBLING_CHANNEL_ID} from '../config/constants.js';

export class LotteryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'lottery',
            description: 'Manage lotteries in the server'
        });
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('lottery')
                .setDescription('Manage lotteries in the server')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('create')
                        .setDescription('Create a new lottery (Admin only)')
                        .addIntegerOption((option) =>
                            option
                                .setName('prize')
                                .setDescription('Prize amount in coins')
                                .setRequired(true)
                                .setMinValue(100)
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('ticket_price')
                                .setDescription('Price of a ticket in coins')
                                .setRequired(true)
                                .setMinValue(10)
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('duration')
                                .setDescription('Duration in hours')
                                .setRequired(true)
                                .setMinValue(1)
                                .setMaxValue(168)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('draw')
                        .setDescription('Draw a winner for a lottery (Admin only)')
                        .addStringOption((option) =>
                            option
                                .setName('lottery_id')
                                .setDescription('The ID of the lottery to draw')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('info')
                        .setDescription('List all active lotteries')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('buy')
                        .setDescription('Buy a ticket for a lottery')
                        .addStringOption((option) =>
                            option
                                .setName('lottery_id')
                                .setDescription('ID of the lottery')
                                .setRequired(true)
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('amount')
                                .setDescription('Number of tickets to buy (default: 1)')
                                .setMinValue(1)
                                .setMaxValue(10)
                        )
                )
        );
    }

    async chatInputRun(interaction) {
        // Check if the interaction is in the correct channel
    if (interaction.channel.id !== GAMBLING_CHANNEL_ID) {
        return interaction.reply('You can only access lottery in the gambling channel!');
      }
        try {
                
            await interaction.deferReply({ ephemeral: false });

            const subcommand = interaction.options.getSubcommand(true);

            // Get or create user automatically
            let user = await prisma.user.findUnique({
                where: { id: interaction.user.id }
            });

            // Auto-register if user doesn't exist
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        id: interaction.user.id,
                        wallet: 0,
                        bank: 1000,
                        hoursEarned: 0
                    }
                });
            }

            if (subcommand === 'create' || subcommand === 'draw') {
                if (!interaction.member.roles.cache.has(ROLE_IDS.ADMIN)) {
                    return interaction.editReply('❌ This command is only available to administrators!');
                }
            }

            switch (subcommand) {
                case 'create':
                    await this.createLottery(interaction);
                    break;
                case 'draw':
                    await this.drawLottery(interaction);
                    break;
                case 'info':
                    await this.showActiveLotteries(interaction);
                    break;
                case 'buy':
                    await this.buyTicket(interaction);
                    break;
                default:
                    return interaction.editReply('❌ Invalid subcommand!');
            }
        } catch (error) {
            console.error(`Error in lottery command:`, error);
            return interaction.editReply('An error occurred while processing your command. Please try again later.');
        }
    }

    async createLottery(interaction) {
        const prize = interaction.options.getInteger('prize');
        const ticketPrice = interaction.options.getInteger('ticket_price');
        const duration = interaction.options.getInteger('duration');
        const endTime = new Date(Date.now() + duration * 3600000);

        const lottery = await prisma.lottery.create({
            data: {
                prize,
                ticketPrice,
                endTime,
                active: true,
            },
        });

        const embed = new EmbedBuilder()
            .setTitle('🎉 New Lottery Created!')
            .setColor('#00FF00')
            .addFields(
                { name: 'Lottery ID', value: lottery.id, inline: true },
                { name: 'Prize Pool', value: `${prize} coins`, inline: true },
                { name: 'Ticket Price', value: `${ticketPrice} coins`, inline: true },
                { name: 'Duration', value: `${duration} hours`, inline: true },
                { name: 'Ends At', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Use /lottery buy to purchase tickets!' });

        await interaction.editReply({ embeds: [embed] });
    }

    async drawLottery(interaction) {
        const lotteryId = interaction.options.getString('lottery_id');

        const lottery = await prisma.lottery.findUnique({
            where: { id: lotteryId },
            include: { tickets: true },
        });

        if (!lottery) {
            return interaction.editReply('❌ This lottery does not exist.');
        }

        if (!lottery.active) {
            return interaction.editReply('❌ This lottery has already been drawn.');
        }

        if (lottery.endTime > new Date()) {
            return interaction.editReply('❌ This lottery has not ended yet.');
        }

        if (lottery.tickets.length === 0) {
            await prisma.lottery.update({
                where: { id: lotteryId },
                data: { active: false },
            });

            return interaction.editReply('❌ No tickets were purchased for this lottery. The lottery has been closed.');
        }

        const winnerTicket = lottery.tickets[Math.floor(Math.random() * lottery.tickets.length)];

        await prisma.$transaction([
            prisma.lottery.update({
                where: { id: lotteryId },
                data: { 
                    active: false,
                    winner: winnerTicket.userId
                },
            }),
            prisma.user.update({
                where: { id: winnerTicket.userId },
                data: { wallet: { increment: lottery.prize } },
            })
        ]);

        const embed = new EmbedBuilder()
            .setTitle('🎉 Lottery Winner Drawn!')
            .setColor('#FFD700')
            .addFields(
                { name: 'Lottery ID', value: lotteryId, inline: true },
                { name: 'Prize', value: `${lottery.prize} coins`, inline: true },
                { name: 'Winner', value: `<@${winnerTicket.userId}>`, inline: true },
                { name: 'Total Tickets', value: `${lottery.tickets.length}`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    }

    async showActiveLotteries(interaction) {
        const activeLotteries = await prisma.lottery.findMany({
            where: { active: true },
            include: { tickets: true },
            orderBy: { endTime: 'asc' }
        });

        if (activeLotteries.length === 0) {
            return interaction.editReply('❌ There are no active lotteries at the moment.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Active Lotteries')
            .setColor('#00FF00')
            .setDescription('Here are all the currently active lotteries:');

        for (const lottery of activeLotteries) {
            const userTickets = lottery.tickets.filter(ticket => ticket.userId === interaction.user.id).length;
            const totalTickets = lottery.tickets.length;
            const winChance = totalTickets > 0 ? ((userTickets / totalTickets) * 100).toFixed(2) : '0.00';

            embed.addFields({
                name: `Lottery #${lottery.id}`,
                value: `💰 Prize: ${lottery.prize} coins\n` +
                       `🎟️ Ticket Price: ${lottery.ticketPrice} coins\n` +
                       `📊 Total Tickets: ${totalTickets}\n` +
                       `🎯 Your Tickets: ${userTickets} (${winChance}% chance)\n` +
                       `⏰ Ends: <t:${Math.floor(lottery.endTime.getTime() / 1000)}:R>`,
                inline: false
            });
        }

        embed.setFooter({ text: 'Use /lottery buy <lottery_id> to purchase tickets!' });

        await interaction.editReply({ embeds: [embed] });
    }

    async buyTicket(interaction) {
        const lotteryId = interaction.options.getString('lottery_id');
        const amount = interaction.options.getInteger('amount') || 1;
        const userId = interaction.user.id;

        const lottery = await prisma.lottery.findUnique({
            where: { id: lotteryId },
            include: { tickets: true },
        });

        if (!lottery || !lottery.active) {
            return interaction.editReply('❌ This lottery does not exist or has ended.');
        }

        const totalCost = lottery.ticketPrice * amount;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (user.wallet < totalCost) {
            return interaction.editReply(`❌ Insufficient funds! You need ${totalCost} coins to buy ${amount} ticket${amount > 1 ? 's' : ''}.`);
        }

        await prisma.$transaction(async (prisma) => {
            const ticketPromises = Array(amount).fill(0).map(() =>
                prisma.lotteryTicket.create({
                    data: {
                        userId,
                        lotteryId,
                    },
                })
            );
            await Promise.all(ticketPromises);

            await prisma.user.update({
                where: { id: userId },
                data: { wallet: { decrement: totalCost } },
            });
        });

        const embed = new EmbedBuilder()
            .setTitle('🎉 Tickets Purchased!')
            .setColor('#00FF00')
            .addFields(
                { name: 'Lottery ID', value: lotteryId, inline: true },
                { name: 'Tickets Bought', value: `${amount}`, inline: true },
                { name: 'Total Cost', value: `${totalCost} coins`, inline: true },
                { name: 'Prize Pool', value: `${lottery.prize} coins`, inline: true },
                { name: 'Ends At', value: `<t:${Math.floor(lottery.endTime.getTime() / 1000)}:R>`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    }
}