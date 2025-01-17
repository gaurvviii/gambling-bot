import { Command } from "@sapphire/framework";
import { getUser  } from "../lib/user.js";
import ROLES from "../config/salaries.js";
import ROLE_IDS from "../config/roleIds.js";
import { prisma } from "../lib/database.js";

export class SalaryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: "salary",
            description: "View or claim your salary based on your role",
        });
    }

    async chatInputRun(interaction) {
        try {
            // Acknowledge the interaction immediately
            await interaction.deferReply();

            const user = await getUser (interaction.user.id);

            if (!user) {
                return interaction.editReply(
                    "You need to register first! Use /register"
                );
            }

            const now = new Date();
            const lastClaimed = user.lastSalaryClaim
                ? new Date(user.lastSalaryClaim)
                : null;

            // Check if the user can claim their salary (changed to 24 hours)
            if (lastClaimed) {
                const hoursSinceLastClaim = Math.floor(
                    (now - lastClaimed) / 3600000
                );
                if (hoursSinceLastClaim < 24) {
                    const hoursRemaining = 24 - hoursSinceLastClaim;
                    return interaction.editReply(
                        `You can only claim your salary once per day. Please wait ${hoursRemaining} hours.`
                    );
                }
            }

            const member = interaction.member;
            let roleKey = "MEMBER"; // Default role

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
            const earnings = hourlyRate * 8; // Multiply hourly rate by 8 hours

            // Update user's wallet and last claim time
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    wallet: { increment: earnings },
                    lastSalaryClaim: now, // Updated field name to match the check above
                    lastClaimDate: now,
                },
            });

            return interaction.editReply(
                `You have claimed your daily salary of $${earnings.toFixed(
                    2
                )} (8 hours worth)!`
            );
        } catch (error) {
            console.error("Error occurred in SalaryCommand:", error); // Log the error for debugging
            if (!interaction.replied) {
                await interaction.editReply(
                    "An error occurred while processing your request. Please try again later."
                ); // User-friendly error message
            }
        }
    }
}