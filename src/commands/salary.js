import { Command } from '@sapphire/framework';
import { getUser } from '../lib/user.js';
import ROLES from '../config/salaries.js';
import ROLE_IDS from '../config/roleIds.js';
import { prisma } from '../lib/database.js';

export class SalaryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'salary',
      description: 'View or claim your salary based on your role'
    });
  }

  async chatInputRun(interaction) {
    try {
      const user = await getUser(interaction.user.id);

      if (!user) {
        return interaction.reply('You need to register first! Use /register');
      }

      const now = new Date();
      const lastClaimed = user.lastSalaryClaim ? new Date(user.lastSalaryClaim) : null;

      // Check if the user can claim their salary
      if (lastClaimed) {
        const hoursSinceLastClaim = Math.floor((now - lastClaimed) / 3600000); // Calculate hours since last claim
        if (hoursSinceLastClaim < 1) {
          return interaction.reply('You can only claim your salary once every hour.');
        }
      }

      // Check if the user has already claimed 8 times today
      if (user.dailyClaims >= 8) {
        return interaction.reply('You have already claimed your salary 8 times today.'); // Message for exceeding claims
      }

      const member = interaction.member;
      let roleKey = 'MEMBER'; // Default role

      // Check roles from highest to lowest priority
      if (member.roles.cache.has(ROLE_IDS.ZYZZ_GOD)) {
        roleKey = 'ZYZZ_GOD';
      } else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS_PLUS)) {
        roleKey = 'DONATOR_PLUS_PLUS';
      } else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS)) {
        roleKey = 'DONATOR_PLUS';
      } else if (member.roles.cache.has(ROLE_IDS.DONATOR)) {
        roleKey = 'DONATOR';
      } else if (member.roles.cache.has(ROLE_IDS.SERVER_BOOSTER)) {
        roleKey = 'SERVER_BOOSTER';
      } else if (member.roles.cache.has(ROLE_IDS.STAFF)) {
        roleKey = 'STAFF';
      }

      const role = ROLES[roleKey];
      const hourlyRate = role.hourlyRate;
      const earnings = hourlyRate; // Earnings for one hour

      // Update user's wallet and last claim time
      await prisma.user.update({
        where: { id: user.id },
        data: {
          wallet: { increment: earnings }, // Increment wallet by the hourly rate
          dailyClaims: { increment: 1 }, // Increment the daily claims made
          lastClaimDate: now, // Set the current date as last claim date
          lastSalary: now // Update last salary date
        }
      });

      return interaction.reply(`You have claimed your salary of $${earnings.toFixed(2)} for this hour!`);
    } catch (error) {
      console.error('Error occurred in SalaryCommand:', error); // Log the error for debugging
      return interaction.reply('An error occurred while processing your request. Please try again later.'); // User-friendly error message
    }
  }
}
