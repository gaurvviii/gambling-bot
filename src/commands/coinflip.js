import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { getUser } from '../lib/user.js'; 

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
    try {
      const bet = interaction.options.getInteger('bet');
      const choice = interaction.options.getString('choice');
      const userId = interaction.user.id;

      // Use getUser to fetch or create the user
      const user = await getUser(userId);

      if (!user) {
        return interaction.reply({
          content: 'You need to register first!',
          ephemeral: true
        });
      }

      if (bet > user.wallet) {
        return interaction.reply({
          content: 'Insufficient funds in wallet!',
          ephemeral: true
        });
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
      await interaction.reply(`
🎲 **Coinflip Result** 🎲
You chose: **${choice}**
Result: **${result}**
${won ? `🎉 You won **$${winnings}**!` : '😢 You lost!'}
      `);
    } catch (error) {
      console.error('Error in CoinflipCommand:', error);
      await interaction.reply({
        content: 'An error occurred while processing your request. Please try again later.',
        ephemeral: true
      });
    }
  }
}

