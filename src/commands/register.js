import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class RegisterCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'register',
      description: 'Register your account'
    });
  }

  async chatInputRun(interaction) {
    const userId = interaction.user.id;

    // Check if the user is already registered
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (existingUser) {
      return interaction.reply('You are already registered!');
    }

    // Register the user
    await prisma.user.create({
      data: {
        id: userId,
        wallet: 0,
        bank: 0,
        // Add other fields as necessary
      }
    });

    return interaction.reply('You have been registered successfully!');
  }
} 