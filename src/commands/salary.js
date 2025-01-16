import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import ROLES from '../config/salaries.js';
import ROLE_IDS from '../config/roleIds.js';

export class SalaryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'salary',
      description: 'View or claim your salary based on your role'
    });
  }

  async chatInputRun(interaction) {
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (!user) {
      return interaction.reply('You need to register first! Use /register');
    }

    const member = interaction.member;
    let roleKey = 'MEMBER'; // Default role

    // Check roles from highest to lowest priority
    if (member.roles.cache.has(ROLE_IDS.ZYZZ_GOD)) {
      roleKey = 'ZYZZ_GOD';
    } else if (member.roles.cache.some(role => role.name.toLowerCase().includes('donator++'))) {
      roleKey = 'DONATOR_PLUS_PLUS';
    } else if (member.roles.cache.some(role => role.name.toLowerCase().includes('donator+'))) {
      roleKey = 'DONATOR_PLUS';
    } else if (member.roles.cache.some(role => role.name.toLowerCase().includes('donator'))) {
      roleKey = 'DONATOR';
    } else if (member.roles.cache.some(role => role.name.toLowerCase().includes('server booster'))) {
      roleKey = 'SERVER_BOOSTER';
    } else if (member.roles.cache.some(role => role.name.toLowerCase().includes('staff'))) {
      roleKey = 'STAFF';
    }

    const role = ROLES[roleKey];
    const hourlyRate = role.hourlyRate;
    const dailyEarnings = hourlyRate * role.hoursPerDay; // Calculate daily earnings

    // Logic for claiming salary
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wallet: { increment: dailyEarnings },
        lastSalary: new Date()
      }
    });

    return interaction.reply(`You have claimed your salary of $${dailyEarnings.toFixed(2)} for today!`);
  }
} 