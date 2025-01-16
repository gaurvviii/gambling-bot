import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { EmbedBuilder } from 'discord.js';

export class RegisterCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'register',
      description: 'Register your account to start gambling'
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
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (existingUser) {
      return interaction.reply({
        content: '❌ You are already registered!',
        ephemeral: true
      });
    }

    try {
      // Create new user with starting balance
      const user = await prisma.user.create({
        data: {
          id: interaction.user.id,
          wallet: 1000,  // Starting wallet balance
          bank: 1000,    // Starting bank balance
          totalWon: 0,
          totalLost: 0,
          lastSalary: null // Initialize last salary to null
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('🎰 Registration Successful! 🎰')
        .setDescription(`
Welcome to the casino, ${interaction.user.username}!

💰 Starting Balance:
Wallet: $${user.wallet}
Bank: $${user.bank}

Available Commands:
• /balance - Check your balance
• /transfer - Move money between wallet and bank
• /salary - Check and claim your salary
• /leaderboard - View gambling leaderboards

Remember:
• Only money in your wallet can be used for gambling
• Use /transfer to move money between wallet and bank
• Claim your salary daily with /salary claim

Good luck! 🎲
        `)
        .setColor('#00FF00')
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Registration error:', error);
      return interaction.reply({
        content: '❌ An error occurred during registration. Please try again.',
        ephemeral: true
      });
    }
  }
} 