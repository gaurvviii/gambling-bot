import cron from 'node-cron';
import { prisma } from '../lib/database.js';
import { ROLE_IDS, ROLES } from '../config/roleIds.js';

export class SalaryCronJob {
  constructor(client) {
    this.client = client;
    this.startSalaryCron();
  }

  startSalaryCron() {
    // Reset salaries at midnight
    cron.schedule('0 0 * * *', () => this.resetSalaries());

    // Credit salary every hour, up to 8 hours per day
    cron.schedule('0 * * * *', () => this.creditHourlySalaries());
  }

  async resetSalaries() {
    try {
      await prisma.user.updateMany({
        where: {
          hoursEarned: { gt: 0 }
        },
        data: {
          hoursEarned: 0,
          lastEarningStart: new Date()
        }
      });
      console.log('Successfully reset all salaries');
    } catch (error) {
      console.error('Error resetting salaries:', error);
    }
  }

  async creditHourlySalaries() {
    try {
      const now = new Date();
      const guild = this.client.guilds.cache.first();
      
      if (!guild) {
        console.error('No guild found');
        return;
      }

      // Fetch eligible users who haven't maxed out their hours
      const users = await prisma.user.findMany({
        where: {
          hoursEarned: { lt: 8 },
          lastEarningStart: { not: null }
        }
      });

      // Fetch all guild members once to avoid multiple API calls
      const members = await guild.members.fetch();

      for (const user of users) {
        try {
          const member = members.get(user.id);
          
          // Skip if user is not in the guild anymore
          if (!member) {
            console.log(`User ${user.id} not found in guild`);
            continue;
          }

          const lastEarningStart = new Date(user.lastEarningStart);
          const hoursPassed = Math.floor((now - lastEarningStart) / 3600000);

          if (hoursPassed >= 1) {
            // Determine highest applicable role and corresponding salary
            const roleKey = this.determineHighestRole(member);
            const role = ROLES[roleKey];
            const hourlyRate = role.hourlyRate;

            // Calculate new hours (capped at 8)
            const newHours = Math.min(8, user.hoursEarned + 1);

            // Update user's wallet and hours
            await prisma.user.update({
              where: { id: user.id },
              data: {
                wallet: { increment: hourlyRate },
                hoursEarned: newHours,
                lastEarningStart: now
              }
            });

            console.log(`Credited ${hourlyRate} to user ${user.id} (${roleKey})`);
          }
        } catch (error) {
          console.error(`Error processing salary for user ${user.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in salary cron job:', error);
    }
  }

  determineHighestRole(member) {
    // Check roles in order of highest to lowest priority
    const roleHierarchy = [
      { id: ROLE_IDS.STAFF, key: 'STAFF' },
      { id: ROLE_IDS.ZYZZ_GOD, key: 'ZYZZ_GOD' },
      { id: ROLE_IDS.DONATOR_PLUS_PLUS, key: 'DONATOR_PLUS_PLUS' },
      { id: ROLE_IDS.DONATOR_PLUS, key: 'DONATOR_PLUS' },
      { id: ROLE_IDS.DONATOR, key: 'DONATOR' },
      { id: ROLE_IDS.SERVER_BOOSTER, key: 'SERVER_BOOSTER' }
    ];

    for (const role of roleHierarchy) {
      if (member.roles.cache.has(role.id)) {
        return role.key;
      }
    }

    return 'MEMBER'; // Default role
  }
}