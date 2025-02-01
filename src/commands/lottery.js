import { Command } from "@sapphire/framework";
import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { prisma } from "../lib/database.js";
import ROLE_IDS from "../config/roleIds.js";
import { GAMBLING_CHANNEL_ID } from "../config/constants.js";

const MAIN_LOTTERY_ID = 1;

function generateId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

async function getActiveLottery(prisma) {
    return prisma.lottery.findFirst({
        where: {
            main: MAIN_LOTTERY_ID,
            active: true,
        },
    });
}

export class LotteryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: "lottery",
            description: "Manage lottery system",
        });
    }

    async registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("create")
                        .setDescription("Create a new lottery")
                        .addIntegerOption((option) =>
                            option
                                .setName("prize")
                                .setDescription("The prize for the lottery")
                                .setRequired(true)
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName("ticket_price")
                                .setDescription("The price of each ticket")
                                .setRequired(true)
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName("hours")
                                .setDescription(
                                    "The duration of the lottery in hours"
                                )
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("info")
                        .setDescription(
                            "Show information about the current lottery"
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("buy")
                        .setDescription("Buy tickets for the current lottery")
                        .addIntegerOption((option) =>
                            option
                                .setName("amount")
                                .setDescription("The number of tickets to buy")
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("draw")
                        .setDescription(
                            "Draw the winner of the current lottery"
                        )
                )
        );
    }

    async chatInputRun(interaction) {
        if (interaction.channel.id !== GAMBLING_CHANNEL_ID) {
            return interaction.reply({
                content:
                    "❌ You can only access the lottery in the gambling channel!",
                ephemeral: true,
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const subcommand = interaction.options.getSubcommand(true);

            if (
                (subcommand === "create" || subcommand === "draw") &&
                !interaction.member.roles.cache.has(ROLE_IDS.OWNER)
            ) {
                return interaction.editReply(
                    "❌ This command is only available to the server owner!"
                );
            }

            let user = await prisma.user.findUnique({
                where: { id: interaction.user.id },
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        id: interaction.user.id,
                        wallet: 0,
                        bank: 1000,
                        hoursEarned: 0,
                    },
                });
            }

            switch (subcommand) {
                case "create":
                    await this.createLottery(interaction);
                    break;
                case "draw":
                    await this.drawLottery(interaction);
                    break;
                case "info":
                    await this.showLotteryInfo(interaction);
                    break;
                case "buy":
                    await this.buyTickets(interaction);
                    break;
            }
        } catch (error) {
            console.error("Error in lottery command:", error);
            return interaction.editReply(
                "❌ An error occurred while processing your command. Please try again later."
            );
        }
    }

    async createLottery(interaction) {
        try {
            const activeLottery = await getActiveLottery(prisma);

            if (activeLottery) {
                return interaction.editReply(
                    "❌ There is already an active lottery! Wait for it to end before creating a new one."
                );
            }

            // Update any existing lottery with main value
            await prisma.lottery.updateMany({
                where: {
                    main: MAIN_LOTTERY_ID,
                },
                data: {
                    main: null,
                },
            });

            const prize = interaction.options.getInteger("prize");
            const ticketPrice = interaction.options.getInteger("ticket_price");
            const hours = interaction.options.getInteger("hours");
            const endTime = new Date(Date.now() + hours * 3600000);

            const lottery = await prisma.lottery.create({
                data: {
                    id: generateId(),
                    prize,
                    ticketPrice,
                    endTime,
                    active: true,
                    main: MAIN_LOTTERY_ID,
                },
            });

            const embed = new EmbedBuilder()
                .setTitle("🎰 **Lottery Created!** 🎰")
                .setColor("#FFD700")
                .addFields(
                    {
                        name: "💰 **Prize Pool**",
                        value: `\`${prize}\` coins`,
                        inline: true,
                    },
                    {
                        name: "🎟️ **Ticket Price**",
                        value: `\`${ticketPrice}\` coins`,
                        inline: true,
                    },
                    {
                        name: "⏱️ **Duration**",
                        value: `\`${hours}\` hours`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: " 🎯 Use /lottery buy to purchase tickets!\n📊 Use /lottery info to stay up to date with the current lottery!",
                });

            const announcementChannel = await interaction.guild.channels.fetch(
                GAMBLING_CHANNEL_ID
            );
            if (announcementChannel) {
                await announcementChannel.send({
                    content:
                        "🌟 **NEW LOTTERY** 🌟\n@everyone\n🎲 Try your luck in our newest lottery! Buy your tickets now! 🎲",
                    embeds: [embed],
                });
            }

            await interaction.editReply({
                content:
                    "✨ Lottery created successfully! Check the announcement in the channel.",
            });
        } catch (error) {
            console.error("Error creating lottery:", error);
            if (error.code === "P2002") {
                return interaction.editReply(
                    "❌ There was an issue creating the lottery. Please try again."
                );
            }
            throw error;
        }
    }

    async drawLottery(interaction) {
        const lottery = await getActiveLottery(prisma);

        if (!lottery) {
            return interaction.editReply("❌ No active lottery to draw.");
        }

        const lotteryWithTickets = await prisma.lottery.findFirst({
            where: {
                id: lottery.id,
            },
            include: { tickets: true },
        });

        if (lotteryWithTickets.tickets.length === 0) {
            await prisma.lottery.update({
                where: { id: lottery.id },
                data: {
                    active: false,
                    main: null,
                },
            });
            return interaction.editReply(
                "❌ No tickets were purchased. The lottery has been closed."
            );
        }

        const mainRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("random_winner")
                .setLabel("Random Winner")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("no_winner")
                .setLabel("No Winner")
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle("🎯 Draw Lottery Winner")
            .setDescription("Choose how to determine the winner:")
            .addFields(
                {
                    name: "💰 Prize Pool",
                    value: `${lotteryWithTickets.prize} coins`,
                    inline: true,
                },
                {
                    name: "📊 Total Tickets",
                    value: `${lotteryWithTickets.tickets.length}`,
                    inline: true,
                }
            );

        const message = await interaction.editReply({
            embeds: [embed],
            components: [mainRow],
        });

        const collector = message.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000,
        });

        collector.on("collect", async (i) => {
            await i.deferUpdate();

            if (i.customId === "random_winner") {
                const winnerTicket =
                    lotteryWithTickets.tickets[
                        Math.floor(
                            Math.random() * lotteryWithTickets.tickets.length
                        )
                    ];
                await this.announceWinner(
                    interaction,
                    lotteryWithTickets,
                    winnerTicket.userId
                );
            } else if (i.customId === "no_winner") {
                await prisma.lottery.update({
                    where: { id: lottery.id },
                    data: {
                        active: false,
                        main: null,
                    },
                });

                await interaction.guild.channels
                    .fetch(GAMBLING_CHANNEL_ID)
                    .then((channel) => {
                        channel.send(
                            "❌ **BETTER LUCK NEXT TIME** 🚫\nUnfortunately, no one won this time. @everyone"
                        );
                    });

                await interaction.editReply({
                    content: "✅ Lottery cancelled.",
                    components: [],
                    embeds: [],
                });
            }

            collector.stop();
        });

        collector.on("end", (collected) => {
            if (!collected.size) {
                interaction.editReply({
                    content: "⏱️ Selection timed out",
                    components: [],
                    embeds: [],
                });
            }
        });
    }

    async announceWinner(interaction, lottery, winnerId) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            const winnerTicketCount = lottery.tickets.filter(
                (ticket) => ticket.userId === winnerId
            ).length;
            const totalTickets = lottery.tickets.length;
            const winChance = (
                (winnerTicketCount / totalTickets) *
                100
            ).toFixed(2);

            await prisma.$transaction([
                prisma.lottery.update({
                    where: { id: lottery.id },
                    data: {
                        active: false,
                        main: null,
                        winner: winnerId,
                    },
                }),
                prisma.user.update({
                    where: { id: winnerId },
                    data: {
                        wallet: { increment: lottery.prize },
                    },
                }),
            ]);

            const embed = new EmbedBuilder()
                .setTitle("🎉 Lottery Winner!")
                .setColor("#FFD700")
                .addFields(
                    {
                        name: "💰 Prize Pool",
                        value: `${lottery.prize} coins`,
                        inline: true,
                    },
                    {
                        name: "👑 Winner",
                        value: `<@${winnerId}>`,
                        inline: true,
                    },
                    {
                        name: "🎟️ Winner's Tickets",
                        value: `${winnerTicketCount}/${totalTickets} (${winChance}% chance)`,
                        inline: true,
                    }
                )
                .setTimestamp();

            if (GAMBLING_CHANNEL_ID) {
                const channel = await interaction.guild.channels.fetch(
                    GAMBLING_CHANNEL_ID
                );
                await channel.send({
                    content: `@everyone\n🎊 **LOTTERY WINNER ANNOUNCED!**\nCongratulations <@${winnerId}>! You've won ${lottery.prize} coins! 🏆`,
                    embeds: [embed],
                });
            }

            await interaction.editReply({
                content: "✅ Winner announced!",
                components: [],
                embeds: [],
            });
        } catch (error) {
            console.error("Error in announceWinner:", error);
            throw error;
        }
    }

    async showLotteryInfo(interaction) {
        const lottery = await prisma.lottery.findFirst({
            where: {
                main: MAIN_LOTTERY_ID,
                active: true,
            },
            include: { tickets: true },
        });

        if (!lottery) {
            return interaction.editReply(
                "❌ There is no active lottery at the moment."
            );
        }

        const userTickets = lottery.tickets.filter(
            (ticket) => ticket.userId === interaction.user.id
        ).length;
        const totalTickets = lottery.tickets.length;
        const winChance =
            totalTickets > 0
                ? ((userTickets / totalTickets) * 100).toFixed(2)
                : "0.00";

        const timeLeft = Math.max(
            0,
            Math.floor((lottery.endTime - new Date()) / 1000)
        );
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);

        const embed = new EmbedBuilder()
            .setTitle("🎰 **Active Lottery** 🎰")
            .setColor("#FFD700")
            .addFields(
                {
                    name: "💰 **Prize Pool**",
                    value: `\`${lottery.prize}\` coins`,
                    inline: true,
                },
                {
                    name: "🎟️ **Ticket Price**",
                    value: `\`${lottery.ticketPrice}\` coins`,
                    inline: true,
                },
                {
                    name: "⏱️ **Time Left**",
                    value: `\`${hours}h ${minutes}m\``,
                    inline: true,
                },
                {
                    name: "📊 **Total Tickets**",
                    value: `\`${totalTickets}\``,
                    inline: true,
                },
                {
                    name: "🎯 **Your Tickets**",
                    value: `\`${userTickets}\` (\`${winChance}%\` chance)`,
                    inline: true,
                }
            )
            .setFooter({ text: "🎲 Use /lottery buy to purchase tickets!" });

        await interaction.editReply({ embeds: [embed] });
    }

    async buyTickets(interaction) {
        const amount = interaction.options.getInteger("amount");

        const lottery = await getActiveLottery(prisma);

        if (!lottery) {
            return interaction.editReply(
                "❌ There is no active lottery at the moment."
            );
        }

        const totalCost = lottery.ticketPrice * amount;
        const user = await prisma.user.findUnique({
            where: { id: interaction.user.id },
        });

        if (!user) {
            return interaction.editReply(
                "❌ You need to have a wallet to buy tickets!"
            );
        }

        if (user.wallet < totalCost) {
            return interaction.editReply(
                `❌ Insufficient funds! You need \`${totalCost}\` coins to buy \`${amount}\` ticket${
                    amount > 1 ? "s" : ""
                }.`
            );
        }

        try {
            const ticketData = Array(amount)
                .fill(0)
                .map(() => ({
                    id: generateId(),
                    userId: interaction.user.id,
                    lotteryId: lottery.id,
                }));

            await prisma.$transaction([
                prisma.user.update({
                    where: { id: interaction.user.id },
                    data: {
                        wallet: { decrement: totalCost },
                    },
                }),
                prisma.lotteryTicket.createMany({
                    data: ticketData,
                }),
            ]);

            const embed = new EmbedBuilder()
                .setTitle("🎉 **Tickets Purchased!** 🎉")
                .setColor("#FFD700")
                .addFields(
                    {
                        name: "🎟️ **Tickets Bought**",
                        value: `\`${amount}\``,
                        inline: true,
                    },
                    {
                        name: "💰 **Total Cost**",
                        value: `\`${totalCost}\` coins`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: "📊 Use /lottery info to check your total tickets!",
                });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error buying tickets:", error);
            await interaction.editReply(
                "❌ An error occurred while purchasing tickets. Please try again."
            );
        }
    }
}
