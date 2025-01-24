import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import cron from 'node-cron';
import ROLES from '../config/salaries.js';
import ROLE_IDS from '../config/roleIds.js';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

export class SalaryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'salary',
      description: 'View your salary progress and earnings'
    });

    // Start the automatic salary task using cron
    this.startSalaryCron();
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
      const hoursEarned = user.hoursEarned || 0;
      const lastEarningStart = user.lastEarningStart ? new Date(user.lastEarningStart) : null;

      // Calculate total earnings so far today
      const totalEarnings = hoursEarned * hourlyRate;

      // Calculate minutes until next hour
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const minutesUntilNext = Math.floor((nextHour.getTime() - now.getTime()) / 60000);

      const embed = new EmbedBuilder()
        .setTitle('💰 Salary Information')
        .setColor('#00FF00')
        .addFields(
          { name: 'Your Role', value: highestRole, inline: true },
          { name: 'Hourly Rate', value: `$${hourlyRate}`, inline: true },
          { name: 'Hours Credited Today', value: `${hoursEarned}/8`, inline: true },
          { name: 'Total Earnings Today', value: `$${totalEarnings}`, inline: true }
        )
        .setFooter({ text: 'Salary is automatically credited hourly, up to 8 hours per day' });

      if (hoursEarned >= 8) {
        embed.setDescription('✅ You have earned your full salary for today (8 hours = $' + (8 * hourlyRate) + ').\nCome back tomorrow for more earnings!');
      } else {
        embed.setDescription(`Next hour's salary of $${hourlyRate} will be credited in ${minutesUntilNext} minutes`);
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in salary command:', error);
      return interaction.editReply('An error occurred while checking your salary. Please try again later.');
    }
  }

  startSalaryCron() {
    // Reset salaries at midnight
    cron.schedule('0 0 * * *', async () => {
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
      } catch (error) {
        console.error('Error resetting salaries:', error);
      }
    });

    // Credit salary every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const now = new Date();

        // Get all users who haven't maxed out their hours today
        const users = await prisma.user.findMany({
          where: {
            hoursEarned: { lt: 8 },
            lastEarningStart: { not: null }
          }
        });

        for (const user of users) {
          try {
            const lastEarningStart = new Date(user.lastEarningStart);
            const hoursPassed = Math.floor((now - lastEarningStart) / 3600000); // Convert ms to hours

            if (hoursPassed >= 1) {
              // Fetch the user's guild member to check roles
              const guild = this.container.client.guilds.cache.first();
              const member = await guild?.members.fetch(user.id).catch(() => null);

              if (!member) continue;

              // Determine role and salary
              let roleKey = 'MEMBER';
              if (member.roles.cache.has(ROLE_IDS.ZYZZ_GOD)) roleKey = 'ZYZZ_GOD';
              else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS_PLUS)) roleKey = 'DONATOR_PLUS_PLUS';
              else if (member.roles.cache.has(ROLE_IDS.DONATOR_PLUS)) roleKey = 'DONATOR_PLUS';
              else if (member.roles.cache.has(ROLE_IDS.DONATOR)) roleKey = 'DONATOR';
              else if (member.roles.cache.has(ROLE_IDS.SERVER_BOOSTER)) roleKey = 'SERVER_BOOSTER';
              else if (member.roles.cache.has(ROLE_IDS.STAFF)) roleKey = 'STAFF';

              const role = ROLES[roleKey];
              const hourlyRate = role.hourlyRate;

              // Calculate new hours and earnings, capped at 8 hours
              const newHours = Math.min(8, user.hoursEarned + 1);

              // Update user's wallet and hours
              try {
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    wallet: { increment: hourlyRate },
                    hoursEarned: newHours,
                    lastEarningStart: now,
                  },
                });
              } catch (error) {
                console.error(`Error updating wallet for user ${user.id}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error processing salary for user ${user.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in salary cron job:', error);
      }
    });
  }
}
