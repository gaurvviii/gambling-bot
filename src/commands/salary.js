import { Command } from "@sapphire/framework";
import ROLES from "../config/salaries.js";
import ROLE_IDS from "../config/roleIds.js";
import { prisma } from "../lib/database.js";

export class SalaryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: "salary",
            description: "View or check your salary earnings",
        });
    }

    async chatInputRun(interaction) {
        try {
            await interaction.deferReply();

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

            const now = new Date();
            const dayOfWeek = now.getDay();
            
            // Check if it's weekend (Saturday = 6, Sunday = 0)
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                return interaction.editReply("Salary earning is only available on weekdays (Monday to Friday).");
            }

            const lastClaimed = user.lastSalaryClaim ? new Date(user.lastSalaryClaim) : null;
            const lastEarningStart = user.lastEarningStart ? new Date(user.lastEarningStart) : null;
            const hoursEarned = user.hoursEarned || 0;

            // If we have a last claim time, check if 24 hours have passed
            if (lastClaimed) {
                const hoursSinceLastClaim = Math.floor((now - lastClaimed) / 3600000);
                if (hoursSinceLastClaim < 24) {
                    const hoursRemaining = 24 - hoursSinceLastClaim;
                    return interaction.editReply(
                        `You've already earned your 8 hours of salary today. Next earning period starts in ${hoursRemaining} hours.`
                    );
                }
            }

            // Reset hours if 24 hours have passed since last claim or if it's a new earning period
            if (!lastEarningStart || (lastClaimed && (now - lastClaimed) >= 24 * 3600000)) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        hoursEarned: 0,
                        lastEarningStart: now,
                    },
                });
            }

            // Calculate hours to add based on time passed
            let newHoursEarned = hoursEarned;
            if (lastEarningStart) {
                const hoursPassed = Math.floor((now - lastEarningStart) / 3600000);
                newHoursEarned = Math.min(8, hoursPassed);
            }

            // If no hours have accumulated yet
            if (newHoursEarned === hoursEarned) {
                return interaction.editReply(
                    `You need to wait at least an hour between earnings checks. Current hours earned: ${hoursEarned}/8`
                );
            }

            const member = interaction.member;
            let roleKey = "MEMBER";

            // Check roles from highest to lowest priority
            if (member.roles.cache.has(ROLE_IDS.ZYZZ_GOD)) {
                roleKey = "ZYZZ_GOD";
            } else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS_PLUS)) {
                roleKey = "DONATOR_PLUS_PLUS";
            } else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS)) {
                roleKey = "DONATOR_PLUS";
            } else if (member.roles.cache.has(ROLE_IDS.DONATOR)) {
                roleKey = "DONATOR";
            } else if (member.roles.cache.has(ROLE_IDS.SERVER_BOOSTER)) {
                roleKey = "SERVER_BOOSTER";
            } else if (member.roles.cache.has(ROLE_IDS.STAFF)) {
                roleKey = "STAFF";
            }

            const role = ROLES[roleKey];
            const hourlyRate = role.hourlyRate;
            const hoursToAdd = newHoursEarned - hoursEarned;
            const earnings = hourlyRate * hoursToAdd;

            // Update user's wallet and tracking fields
            const updateData = {
                wallet: { increment: earnings },
                hoursEarned: newHoursEarned,
            };

            // If 8 hours are completed, set the lastSalaryClaim
            if (newHoursEarned >= 8) {
                updateData.lastSalaryClaim = now;
            }

            await prisma.user.update({
                where: { id: user.id },
                data: updateData,
            });

            return interaction.editReply(
                `You have earned $${earnings.toFixed(2)} for ${hoursToAdd} hour(s)! ` +
                `Total hours earned today: ${newHoursEarned}/8\n` +
                `${newHoursEarned >= 8 ? "You've completed your 8 hours for today! Come back tomorrow for more earnings." : 
                  `Keep checking back to earn more! (${8 - newHoursEarned} hours remaining)`}`
            );

        } catch (error) {
            console.error("Error occurred in SalaryCommand:", error);
            if (!interaction.replied) {
                await interaction.editReply(
                    "An error occurred while processing your request. Please try again later."
                );
            }
        }
    }
}