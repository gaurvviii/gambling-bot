import cron from 'node-cron';
import { prisma } from '../lib/database.js';
import ROLE_IDS from '../config/roleIds.js';
import ROLES from '../config/salaries.js';

export class SalaryCronJob {
  constructor(client) {
    this.client = client;
    this.guildId = '1325400597117009971'; // server id done
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
      console.log('Successfully reset all salaries at midnight');
    } catch (error) {
      console.error('Error resetting salaries:', error);
    }
  }

  async creditHourlySalaries() {
    try {
      const now = new Date();
      const guild = this.client.guilds.cache.get(this.guildId);

      if (!guild) {
        console.error(`Guild with ID ${this.guildId} not found`);
        return;
      }

      // Fetch all guild members
      const members = await guild.members.fetch();

      for (const member of members.values()) {
        try {
          // Check if the user exists in the database
          let user = await prisma.user.findUnique({ where: { id: member.id } });

          if (!user) {
            // Create a new user if they are not found
            user = await prisma.user.create({
              data: {
                id: member.id,
                bank: 1000,
                wallet: 0,
                hoursEarned: 0,
                lastEarningStart: now
              }
            });
            console.log(`Created a new user entry for ${member.id}`);
          }

          // Determine the time passed since the last earning start
          const lastEarningStart = new Date(user.lastEarningStart);
          const hoursPassed = Math.floor((now - lastEarningStart) / 3600000);

          if (hoursPassed >= 1 && user.hoursEarned < 8) {
            // Determine the user's highest role dynamically
            const roleKey = this.determineHighestRole(member);
            const role = ROLES[roleKey];

            if (!role || !role.hourlyRate) {
              console.error(`Role or hourly rate not found for ${roleKey}`);
              continue;
            }

            const hourlyRate = role.hourlyRate;

            // Calculate new hours (capped at 8)
            const newHours = Math.min(8, user.hoursEarned + hoursPassed);

            // Update the user's wallet and hours
            await prisma.user.update({
              where: { id: user.id },
              data: {
                wallet: { increment: hourlyRate * hoursPassed },
                hoursEarned: newHours,
                lastEarningStart: now
              }
            });

            console.log(`Credited ${hourlyRate * hoursPassed} to user ${user.id} (${roleKey})`);
          }
        } catch (error) {
          console.error(`Error processing salary for member ${member.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in crediting hourly salaries:', error);
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
      { id: ROLE_IDS.SERVER_BOOSTER, key: 'SERVER_BOOSTER' },
      { id: ROLE_IDS.MEMBER, key: 'MEMBER' }
    ];

    for (const role of roleHierarchy) {
      if (member.roles.cache.has(role.id)) {
        return role.key;
      }
    }

    return 'MEMBER'; // Default role
  }
}
