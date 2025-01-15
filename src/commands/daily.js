import { Command } from '@sapphire/framework';
import { prisma, getUser } from '../lib/database.js';

const DAILY_AMOUNT = 1000;
const STREAK_BONUS = 100;
const MAX_STREAK = 7;

export class DailyCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'daily',
      description: 'Claim your daily rewards'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  async chatInputRun(interaction) {
    const user = await getUser(interaction.user.id);
    const now = new Date();
    
    if (user.lastDaily) {
      const lastDaily = new Date(user.lastDaily);
      const timeDiff = now - lastDaily;
      const hoursLeft = 24 - Math.floor(timeDiff / (1000 * 60 * 60));
      
      if (timeDiff < 24 * 60 * 60 * 1000) {
        return interaction.reply(
          `You can claim your daily reward in ${hoursLeft} hours!`
        );
      }

      // Check if streak should continue or reset
      const daysSinceLastClaim = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      if (daysSinceLastClaim > 1) {
        user.streak = 0;
      }
    }

    // Calculate reward
    const streak = Math.min(user.streak + 1, MAX_STREAK);
    const streakBonus = STREAK_BONUS * streak;
    const totalReward = DAILY_AMOUNT + streakBonus;

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: totalReward },
        lastDaily: now,
        streak: streak
      }
    });

    return interaction.reply(`
🎁 Daily Reward Claimed! 🎁
Base Reward: $${DAILY_AMOUNT}
Streak: ${streak} days (Bonus: $${streakBonus})
Total Reward: $${totalReward}

Come back tomorrow to keep your streak going!
    `);
  }
} 