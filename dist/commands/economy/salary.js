import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { SALARY_RATES, WORK_HOURS, WORK_DAYS } from '../../lib/constants';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class SalaryCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'salary',
            description: 'Check your salary rate and earnings'
        });
    }
    async messageRun(message) {
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        const role = user?.role || 'Member';
        const hourlyRate = SALARY_RATES[role];
        const dailyEarnings = hourlyRate * WORK_HOURS;
        const weeklyEarnings = dailyEarnings * WORK_DAYS;
        const monthlyEarnings = weeklyEarnings * 4;
        const embed = new EmbedBuilder()
            .setTitle('💰 Your Salary Information')
            .setColor('#00ff00')
            .addFields({ name: 'Role', value: role, inline: true }, { name: 'Hourly Rate', value: `$${hourlyRate.toFixed(2)}`, inline: true }, { name: 'Daily Earnings', value: `$${dailyEarnings.toFixed(2)}`, inline: true }, { name: 'Weekly Earnings', value: `$${weeklyEarnings.toFixed(2)}`, inline: true }, { name: 'Monthly Earnings', value: `$${monthlyEarnings.toFixed(2)}`, inline: true })
            .setFooter({ text: 'Earnings are automatically added to your bank account' });
        return message.reply({ embeds: [embed] });
    }
}
