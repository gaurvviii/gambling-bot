import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

export class CoinflipCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'coinflip',
      description: 'Flip a coin and bet on heads or tails'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addIntegerOption((option) =>
          option
            .setName('bet')
            .setDescription('Amount to bet')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption((option) =>
          option
            .setName('choice')
            .setDescription('Choose heads or tails')
            .setRequired(true)
            .addChoices(
              { name: 'Heads', value: 'heads' },
              { name: 'Tails', value: 'tails' }
            )
        )
    );
  }

  async chatInputRun(interaction) {
    // Check if command is used in gambling channel
    if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
      return interaction.reply({
        content: '⚠️ This command can only be used in the gambling channel!',
        ephemeral: true
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      const bet = interaction.options.getInteger('bet');
      const choice = interaction.options.getString('choice');
      const userId = interaction.user.id;

      // Get or create user automatically
      let user = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Auto-register if user doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0
          }
        });
      }

      if (bet > user.wallet) {
        return interaction.editReply('Insufficient funds in wallet!');
      }

      // Deduct the bet amount
      await prisma.user.update({
        where: { id: userId },
        data: {
          wallet: { decrement: bet }
        }
      });

      // Simulate the coin flip
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = choice === result;
      const winnings = won ? bet * 2 : 0;

      // Update the user's wallet based on the result
      if (won) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            wallet: { increment: winnings },
            totalWon: { increment: winnings - bet }
          }
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalLost: { increment: bet }
          }
        });
      }

      // Respond with the result
      return interaction.editReply(`
🎲 **Coinflip Result** 🎲
You chose: **${choice}**
Result: **${result}**
${won ? `🎉 You won **$${winnings}**!` : '😢 You lost!'}
      `);
    } catch (error) {
      console.error('Error in CoinflipCommand:', error);
      return interaction.editReply('An error occurred while processing your request. Please try again later.');
    }
  }
}
