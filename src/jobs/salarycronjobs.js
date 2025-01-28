import cron from 'node-cron';
import { prisma } from '../lib/database.js';
import ROLE_IDS from '../config/roleIds.js';
import ROLES from '../config/salaries.js';

export class SalaryCronJob {
  constructor(client) {
    this.client = client;
    this.guildId = '1325400597117009971';//done
    this.startSalaryCron();
  }

  startSalaryCron() {
    cron.schedule('0 0 * * *', () => this.resetSalaries());
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

      const members = await guild.members.fetch();

      for (const member of members.values()) {
        try {
          let user = await prisma.user.findUnique({ where: { id: member.id } });

          if (!user) {
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

          const lastEarningStart = new Date(user.lastEarningStart);
          const hoursPassed = Math.floor((now - lastEarningStart) / 3600000);

          if (hoursPassed >= 1 && user.hoursEarned < 8) {
            const roleKey = this.determineHighestRole(member);
            const role = ROLES[roleKey];

            if (!role || !role.hourlyRate) {
              console.error(`Role or hourly rate not found for ${roleKey}`);
              continue;
            }

            let hourlyRate = role.hourlyRate;
            
            // Add booster bonus if they are a server booster
            const isBooster = member.roles.cache.has(ROLE_IDS.SERVER_BOOSTER);
            if (isBooster) {
              hourlyRate += 2.5; // Add booster bonus
            }

            const newHours = Math.min(8, user.hoursEarned + hoursPassed);

            await prisma.user.update({
              where: { id: user.id },
              data: {
                wallet: { increment: hourlyRate * hoursPassed },
                hoursEarned: newHours,
                lastEarningStart: now
              }
            });

            console.log(`Credited ${hourlyRate * hoursPassed} to user ${user.id} (${roleKey}${isBooster ? ' + Booster Bonus' : ''})`);
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
    const roleHierarchy = [
      { id: ROLE_IDS.OWNER, key: "OWNER", name: "Owner" },
                { id: ROLE_IDS.ADMIN, key: "ADMIN", name: "Admin" },
                { id: ROLE_IDS.MODERATOR, key: "MODERATOR", name: "Moderator" },
                { id: ROLE_IDS.STAFF, key: "STAFF", name: "Staff Member" },
                { id: ROLE_IDS.DEVELOPER, key: "DEVELOPER", name: "Developer" },
                { id: ROLE_IDS.ZYZZ_GOD, key: "ZYZZ_GOD", name: "Zyzz God" },
                { id: ROLE_IDS.DONATOR_PLUS_PLUS, key: "DONATOR_PLUS_PLUS", name: "Donator++" },
                { id: ROLE_IDS.DONATOR_PLUS, key: "DONATOR_PLUS", name: "Donator+" },
                { id: ROLE_IDS.DONATOR, key: "DONATOR", name: "Donator" },
                { id: ROLE_IDS.SERVER_BOOSTER, key: "SERVER_BOOSTER", name: "Server Booster" },
    ];

    for (const role of roleHierarchy) {
      if (member.roles.cache.has(role.id)) {
        return role.key;
      }
    }

    return 'MEMBER';
  }
}