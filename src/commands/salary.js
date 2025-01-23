import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import ROLES from '../config/salaries.js';
import ROLE_IDS from '../config/roleIds.js';
import { prisma } from '../lib/database.js';

export class SalaryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'salary',
      description: 'View and claim your salary'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
    );
  }

  async chatInputRun(interaction) {
try {
  await interaction.deferReply();

  // Check if command is used in a guild
  if (!interaction.inGuild()) {
    return interaction.editReply('⚠️ This command can only be used in a server, not in DMs.');
  }

  const now = new Date();
  const dayOfWeek = now.getDay();

  // Check if it's weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return interaction.editReply('⚠️ Salary earning is paused during weekends (Saturday and Sunday)');
  }

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
        hoursEarned: 0,
        lastEarningStart: now
      }
    });
  }

  // Safely get member and check roles
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member) {
    return interaction.editReply('⚠️ Unable to fetch your member information. Please try again.');
  }

  let roleKey = 'MEMBER';
  let highestRole = 'Basic Member';

  // Check roles from highest to lowest priority
  if (member.roles.cache.has(ROLE_IDS.ZYZZ_GOD)) {
    roleKey = 'ZYZZ_GOD';
    highestRole = 'Zyzz God';
  } else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS_PLUS)) {
    roleKey = 'DONATOR_PLUS_PLUS';
    highestRole = 'Donator++';
  } else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS)) {
    roleKey = 'DONATOR_PLUS';
    highestRole = 'Donator+';
  } else if (member.roles.cache.has(ROLE_IDS.DONATOR)) {
    roleKey = 'DONATOR';
    highestRole = 'Donator';
  } else if (member.roles.cache.has(ROLE_IDS.SERVER_BOOSTER)) {
    roleKey = 'SERVER_BOOSTER';
    highestRole = 'Server Booster';
  } else if (member.roles.cache.has(ROLE_IDS.STAFF)) {
    roleKey = 'STAFF';
    highestRole = 'Staff Member';
  }

      const role = ROLES[roleKey];
      const hourlyRate = role.hourlyRate;
      let hoursEarned = user.hoursEarned || 0;
      const lastEarningStart = user.lastEarningStart ? new Date(user.lastEarningStart) : null;

      // Reset hours if it's a new day
      if (lastEarningStart && lastEarningStart.getDate() !== now.getDate()) {
        hoursEarned = 0;
      }

      // Calculate hours passed and potential earnings
      let potentialEarnings = 0;
      let newHoursEarned = hoursEarned;
      let shouldUpdateTimer = false;

      if (lastEarningStart) {
        const hoursPassed = Math.floor((now - lastEarningStart) / 3600000); // Convert ms to hours
        newHoursEarned = Math.min(8, hoursEarned + hoursPassed);
        
        if (newHoursEarned > hoursEarned && newHoursEarned <= 8) {
          potentialEarnings = (newHoursEarned - hoursEarned) * hourlyRate;
          shouldUpdateTimer = true;
        }
      } else {
        // First time earning
        newHoursEarned = 1;
        potentialEarnings = hourlyRate;
        shouldUpdateTimer = true;
      }

      // Update user's wallet and reset timer if there are earnings
      if (potentialEarnings > 0) {
        await prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            wallet: { increment: potentialEarnings },
            hoursEarned: newHoursEarned,
            lastEarningStart: shouldUpdateTimer ? now : undefined
          }
        });

        user = await prisma.user.findUnique({
          where: { id: interaction.user.id }
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('💰 Salary Information')
        .setColor('#00FF00')
        .addFields(
          { name: 'Your Role', value: highestRole, inline: true },
          { name: 'Hourly Rate', value: `$${hourlyRate}`, inline: true },
          { name: 'Hours Earned Today', value: `${newHoursEarned}/8`, inline: true }
        )
        .setFooter({ text: 'Salary is earned hourly during weekdays, up to 8 hours per day' });

      if (potentialEarnings > 0) {
        embed.addFields({
          name: 'Earnings Claimed', 
          value: `$${potentialEarnings}`, 
          inline: true
        });
        embed.setDescription(`✅ Successfully claimed $${potentialEarnings} in salary!\nNext hour's earnings will be available <t:${Math.floor(now.getTime() / 1000) + 3600}:R>`);
      } else if (newHoursEarned >= 8) {
        embed.setDescription('You have earned the maximum salary for today (8 hours).\nCome back tomorrow for more earnings!');
      } else {
        const nextHour = new Date(lastEarningStart);
        nextHour.setHours(nextHour.getHours() + 1);
        embed.setDescription(`Next hour's earnings will be available <t:${Math.floor(nextHour.getTime() / 1000)}:R>`);
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in salary command:', error);
      return interaction.editReply('An error occurred while processing your salary. Please try again later.');
    }
  }
}
