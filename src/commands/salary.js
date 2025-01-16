import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { ROLES } from '../config/salaries.js';

export class SalaryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'salary',
      description: 'View or claim your salary based on your role'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand(subcommand =>
          subcommand
            .setName('info')
            .setDescription('View your salary information')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('claim')
            .setDescription('Claim your daily salary')
        )
    );
  }

  async chatInputRun(interaction) {
    const subcommand = interaction.options.getSubcommand();

    const member = interaction.member;
    let roleKey = 'MEMBER'; // Default role

    // Check roles from highest to lowest priority
    if (member.roles.cache.some(role => role.name.toLowerCase().includes('staff'))) {
      roleKey = 'STAFF';
    } else if (member.roles.cache.some(role => role.name === 'Zyzz God')) {
      roleKey = 'ZYZZ_GOD';
    } else if (member.roles.cache.some(role => role.name === 'Donator++')) {
      roleKey = 'DONATOR_PLUS_PLUS';
    } else if (member.roles.cache.some(role => role.name === 'Donator+')) {
      roleKey = 'DONATOR_PLUS';
    } else if (member.roles.cache.some(role => role.name === 'Donator')) {
      roleKey = 'DONATOR';
    }
    
    // Booster is additional to other roles
    const isBooster = member.roles.cache.some(role => role.name === 'Server Booster');
    
    const role = ROLES[roleKey];
    let hourlyRate = role.hourlyRate;
    if (isBooster && roleKey === 'MEMBER') {
      hourlyRate += 2.50; // Booster bonus only applies to base Member rate
    }

    const dailyEarnings = hourlyRate * role.hoursPerDay;

    if (subcommand === 'info') {
      return interaction.reply(`
💰 Salary Information 💰
Role: ${role.name}${isBooster ? ' (Server Booster)' : ''}
Hourly Rate: $${hourlyRate.toFixed(2)}
Daily Earnings: $${dailyEarnings.toFixed(2)}
      `);
    } else if (subcommand === 'claim') {
      const user = await prisma.user.findUnique({
        where: { id: interaction.user.id }
      });

      if (!user) {
        return interaction.reply('You need to register first! Use /register');
      }

      const now = new Date();
      const lastSalary = user.lastSalary ? new Date(user.lastSalary) : null;

      // Check if user has already claimed today
      if (lastSalary && 
          lastSalary.getDate() === now.getDate() && 
          lastSalary.getMonth() === now.getMonth() && 
          lastSalary.getFullYear() === now.getFullYear()) {
        return interaction.reply('❌ You have already claimed your salary today!');
      }

      // Update user's wallet and last claim time
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          wallet: { increment: dailyEarnings },
          lastSalary: now
        }
      });

      return interaction.reply(`
✅ Salary Claimed Successfully! 
Amount: $${dailyEarnings.toFixed(2)}
New Wallet Balance: $${updatedUser.wallet.toFixed(2)}

Next claim available in 24 hours!
      `);
    }
  }
} 