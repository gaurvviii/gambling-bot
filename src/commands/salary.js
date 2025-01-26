import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { prisma } from '../lib/database.js';
import ROLES from '../config/salaries.js';
import ROLE_IDS from '../config/roleIds.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

export class SalaryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'salary',
      description: 'View your salary progress and earnings for the day',
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
      // Restrict command to the gambling channel
      if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
        return interaction.reply({
          content: '⚠️ This command can only be used in the gambling channel!',
          ephemeral: true,
        });
      }

      // Defer the reply
      await interaction.deferReply({ ephemeral: true });

      // Check if command is used in a guild
      if (!interaction.inGuild()) {
        return interaction.editReply('⚠️ This command can only be used in a server, not in DMs.');
      }

      const now = new Date();

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
      
      // Define the role hierarchy
      const roleHierarchy = [
        { id: ROLE_IDS.STAFF, key: 'STAFF', name: 'Staff Member' },
        { id: ROLE_IDS.ZYZZ_GOD, key: 'ZYZZ_GOD', name: 'Zyzz God' },
        { id: ROLE_IDS.DONATOR_PLUS_PLUS, key: 'DONATOR_PLUS_PLUS', name: 'Donator++' },
        { id: ROLE_IDS.DONATOR_PLUS, key: 'DONATOR_PLUS', name: 'Donator+' },
        { id: ROLE_IDS.DONATOR, key: 'DONATOR', name: 'Donator' },
        { id: ROLE_IDS.SERVER_BOOSTER, key: 'SERVER_BOOSTER', name: 'Server Booster' }
      ];
      
      // Check each role in the hierarchy
      for (const role of roleHierarchy) {
        if (member.roles.cache.has(role.id)) {
          roleKey = role.key;
          highestRole = role.name;
          break; // Stop once a role is found
        }
      }
      
      // If no roles were found, fallback to 'MEMBER' (lowest role)
      if (highestRole === 'Basic Member' && !member.roles.cache.size) {
        roleKey = 'MEMBER';
        highestRole = 'Basic Member';
      }
      
      console.log(`Highest role for ${member.user.username}: ${highestRole} (${roleKey})`);
      

      const role = ROLES[roleKey];
      const hourlyRate = role.hourlyRate;
      const hoursEarned = user.hoursEarned || 0;
      const maxHours = 8;
      const totalEarnings = hoursEarned * hourlyRate;

      // Create a progress bar for salary
      const progressBar = this.createProgressBar(hoursEarned, maxHours);

      // Calculate time left for next increment (until next hour)
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const minutesUntilNext = Math.floor((nextHour.getTime() - now.getTime()) / 60000); // Convert to minutes

      const embed = new EmbedBuilder()
        .setTitle('💰 Salary Progress')
        .setColor('#00FF00')
        .addFields(
          { name: 'Your Role', value: highestRole, inline: true },
          { name: 'Hourly Rate', value: `$${hourlyRate}`, inline: true },
          { name: 'Hours Earned Today', value: `${hoursEarned}/${maxHours}`, inline: true },
          { name: 'Total Earnings Today', value: `$${totalEarnings}`, inline: true },
          { name: 'Time Until Next Increment', value: `${minutesUntilNext} minutes`, inline: true }
        )
        .setDescription(`**Salary Progress:**\n${progressBar}`)
        .setFooter({ text: 'Salary is automatically credited hourly, up to 8 hours per day' });

      const response = await interaction.editReply({ embeds: [embed] });

      // Store the message reference for future updates
      this.updateSalaryProgress(response, user.id);

      return response;
    } catch (error) {
      console.error('Error in salary progress command:', error);
      return interaction.editReply('An error occurred while fetching your salary progress. Please try again later.');
    }
  }

  // Helper function to create a progress bar
  createProgressBar(hoursEarned, maxHours) {
    const filled = '🟩';
    const empty = '⬛';
    const progress = Math.floor((hoursEarned / maxHours) * 10);
    const remaining = 10 - progress;
    return `${filled.repeat(progress)}${empty.repeat(remaining)} (${hoursEarned}/${maxHours} hours)`;
  }

  // Function to periodically update the salary progress message
  async updateSalaryProgress(message, userId) {
    setInterval(async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) return;

      const hoursEarned = user.hoursEarned || 0;
      const roleKey = 'STAFF'; // Assuming staff is highest, use the appropriate logic for other roles
      const role = ROLES[roleKey];
      const hourlyRate = role.hourlyRate;
      const maxHours = 8;
      const totalEarnings = hoursEarned * hourlyRate;

      const progressBar = this.createProgressBar(hoursEarned, maxHours);

      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const minutesUntilNext = Math.floor((nextHour.getTime() - new Date().getTime()) / 60000);

      const embed = new EmbedBuilder()
        .setTitle('💰 Salary Progress')
        .setColor('#00FF00')
        .addFields(
          { name: 'Your Role', value: 'Staff Member', inline: true },
          { name: 'Hourly Rate', value: `$${hourlyRate}`, inline: true },
          { name: 'Hours Earned Today', value: `${hoursEarned}/${maxHours}`, inline: true },
          { name: 'Total Earnings Today', value: `$${totalEarnings}`, inline: true },
          { name: 'Time Until Next Increment', value: `${minutesUntilNext} minutes`, inline: true }
        )
        .setDescription(`**Salary Progress:**\n${progressBar}`)
        .setFooter({ text: 'Salary is automatically credited hourly, up to 8 hours per day' });

      // Edit the message with the updated salary progress
      await message.edit({ embeds: [embed] });
    }, 3600000); // Update every hour (3600000 ms)
  }
}
