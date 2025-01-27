import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import { prisma } from "../lib/database.js";
import ROLES from "../config/salaries.js";
import ROLE_IDS from "../config/roleIds.js";
import { GAMBLING_CHANNEL_ID } from "../config/constants.js";

export class SalaryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: "salary",
            description: "View your salary progress and earnings for the day",
        });
    }

    async registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName(this.name).setDescription(this.description)
        );
    }

    async chatInputRun(interaction) {
        try {
            if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
                return interaction.reply({
                    content: "⚠️ This command can only be used in the gambling channel!",
                    ephemeral: true,
                });
            }

            await interaction.deferReply({ ephemeral: true });

            if (!interaction.inGuild()) {
                return interaction.editReply(
                    "⚠️ This command can only be used in a server, not in DMs."
                );
            }

            const now = new Date();
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
                        lastEarningStart: now,
                    },
                });
            }

            const member = await interaction.guild?.members.fetch(
                interaction.user.id
            );
            if (!member) {
                return interaction.editReply(
                    "⚠️ Unable to fetch your member information. Please try again."
                );
            }

            let roleKey = "MEMBER";
            let highestRole = "Basic Member";

            const roleHierarchy = [
                { id: ROLE_IDS.OWNER, key: "OWNER", name: "Owner" },
                { id: ROLE_IDS.ADMIN, key: "ADMIN", name: "Admin" },
                { id: ROLE_IDS.MODERATOR, key: "Moderator", name: "Moderator" },
                { id: ROLE_IDS.STAFF, key: "Moderator", name: "Staff Member" },
                { id: ROLE_IDS.ZYZZ_GOD, key: "ZYZZ_GOD", name: "Zyzz God" },
                { id: ROLE_IDS.DONATOR_PLUS_PLUS, key: "DONATOR_PLUS_PLUS", name: "Donator++" },
                { id: ROLE_IDS.DONATOR_PLUS, key: "DONATOR_PLUS", name: "Donator+" },
                { id: ROLE_IDS.DONATOR, key: "DONATOR", name: "Donator" },
                { id: ROLE_IDS.SERVER_BOOSTER, key: "SERVER_BOOSTER", name: "Server Booster" },
            ];

            for (const role of roleHierarchy) {
                if (member.roles.cache.has(role.id)) {
                    roleKey = role.key;
                    highestRole = role.name;
                    break;
                }
            }

            if (highestRole === "Basic Member" && !member.roles.cache.size) {
                roleKey = "MEMBER";
                highestRole = "Basic Member";
            }

            const role = ROLES[roleKey];
            let hourlyRate = role.hourlyRate;
            
            // Check for server booster bonus
            const isBooster = member.roles.cache.has(ROLE_IDS.SERVER_BOOSTER);
            if (isBooster) {
                hourlyRate += 2.5; // Add booster bonus
            }

            const hoursEarned = user.hoursEarned || 0;
            const maxHours = 8;
            const totalEarnings = hoursEarned * hourlyRate;

            const progressBar = this.createProgressBar(hoursEarned, maxHours);

            const nextHour = new Date();
            nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
            const minutesUntilNext = Math.floor(
                (nextHour.getTime() - now.getTime()) / 60000
            );

            const embed = new EmbedBuilder()
                .setTitle("💰 Salary Progress")
                .setColor("#00FF00")
                .addFields(
                    { name: "Your Role", value: highestRole, inline: true },
                    { name: "Hourly Rate", value: `$${hourlyRate}${isBooster ? ' (includes $2.5 booster bonus)' : ''}`, inline: true },
                    { name: "Hours Earned Today", value: `${hoursEarned}/${maxHours}`, inline: true },
                    { name: "Total Earnings Today", value: `$${totalEarnings}`, inline: true },
                    { name: "Time Until Next Increment", value: `${minutesUntilNext} minutes`, inline: true }
                )
                .setDescription(`**Salary Progress:**\n${progressBar}`)
                .setFooter({
                    text: "Salary is automatically credited hourly, up to 8 hours per day",
                });

            const response = await interaction.editReply({ embeds: [embed] });
            this.updateSalaryProgress(response, user.id);
            return response;
        } catch (error) {
            console.error("Error in salary progress command:", error);
            return interaction.editReply(
                "An error occurred while fetching your salary progress. Please try again later."
            );
        }
    }

    createProgressBar(hoursEarned, maxHours) {
        const filled = "🟩";
        const empty = "⬛";
        const progress = Math.floor((hoursEarned / maxHours) * 10);
        const remaining = 10 - progress;
        return `${filled.repeat(progress)}${empty.repeat(
            remaining
        )} (${hoursEarned}/${maxHours} hours)`;
    }

    async updateSalaryProgress(message, userId) {
        setInterval(async () => {
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) return;

            const member = await message.guild?.members.fetch(userId);
            if (!member) return;

            let roleKey = "MEMBER";
            let highestRole = "Basic Member";

            const roleHierarchy = [
                { id: ROLE_IDS.OWNER, key: "OWNER", name: "Owner" },
                { id: ROLE_IDS.ADMIN, key: "ADMIN", name: "Admin" },
                { id: ROLE_IDS.MODERATOR, key: "Moderator", name: "Moderator" },
                { id: ROLE_IDS.STAFF, key: "Moderator", name: "Staff Member" },
                { id: ROLE_IDS.ZYZZ_GOD, key: "ZYZZ_GOD", name: "Zyzz God" },
                { id: ROLE_IDS.DONATOR_PLUS_PLUS, key: "DONATOR_PLUS_PLUS", name: "Donator++" },
                { id: ROLE_IDS.DONATOR_PLUS, key: "DONATOR_PLUS", name: "Donator+" },
                { id: ROLE_IDS.DONATOR, key: "DONATOR", name: "Donator" },
                { id: ROLE_IDS.SERVER_BOOSTER, key: "SERVER_BOOSTER", name: "Server Booster" },
            ];

            for (const role of roleHierarchy) {
                if (member.roles.cache.has(role.id)) {
                    roleKey = role.key;
                    highestRole = role.name;
                    break;
                }
            }

            const role = ROLES[roleKey];
            let hourlyRate = role.hourlyRate;
            
            // Check for server booster bonus
            const isBooster = member.roles.cache.has(ROLE_IDS.SERVER_BOOSTER);
            if (isBooster) {
                hourlyRate += 2.5; // Add booster bonus
            }

            const hoursEarned = user.hoursEarned || 0;
            const maxHours = 8;
            const totalEarnings = hoursEarned * hourlyRate;

            const progressBar = this.createProgressBar(hoursEarned, maxHours);

            const nextHour = new Date();
            nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
            const minutesUntilNext = Math.floor(
                (nextHour.getTime() - new Date().getTime()) / 60000
            );

            const embed = new EmbedBuilder()
                .setTitle("💰 Salary Progress")
                .setColor("#00FF00")
                .addFields(
                    { name: "Your Role", value: highestRole, inline: true },
                    { name: "Hourly Rate", value: `$${hourlyRate}${isBooster ? ' (includes $2.5 booster bonus)' : ''}`, inline: true },
                    { name: "Hours Earned Today", value: `${hoursEarned}/${maxHours}`, inline: true },
                    { name: "Total Earnings Today", value: `$${totalEarnings}`, inline: true },
                    { name: "Time Until Next Increment", value: `${minutesUntilNext} minutes`, inline: true }
                )
                .setDescription(`**Salary Progress:**\n${progressBar}`)
                .setFooter({
                    text: "Salary is automatically credited hourly, up to 8 hours per day",
                });

            await message.edit({ embeds: [embed] });
        }, 3600000);
    }
}