import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

const HORSES = [
  { name: '🐎 Thunderbolt', odds: 2.0 },
  { name: '🐎 Shadow Runner', odds: 3.0 },
  { name: '🐎 Lucky Star', odds: 4.0 },
  { name: '🐎 Silver Wind', odds: 5.0 },
  { name: '🐎 Golden Flash', odds: 6.0 }
];

const TRACK_LENGTH = 15;

export class HorseRaceCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'horserace',
      description: 'Bet on horse races',
    });
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
      await interaction.deferReply({ephemeral: true});

      // Parse inputs
      const bet = interaction.options.getInteger('bet');
      const horseNumber = interaction.options.getInteger('horse') - 1;

      // Validate inputs
      if (!bet || bet <= 0) {
        return interaction.editReply('⚠️ Please enter a valid bet amount.');
      }
      if (horseNumber < 0 || horseNumber >= HORSES.length) {
        return interaction.editReply('⚠️ Please select a valid horse number (1-5).');
      }

      // Fetch or create the user
      let user = await prisma.user.findUnique({
        where: { id: interaction.user.id },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: interaction.user.id,
            wallet: 0, 
            bank: 1000,
            hoursEarned: 0,
          },
        });
      }

      // Check if the user has sufficient funds
      if (bet > user.wallet) {
        return interaction.editReply('⚠️ You do not have enough funds in your wallet!');
      }

      // Deduct the bet amount from the user's wallet
      await prisma.user.update({
        where: { id: interaction.user.id },
        data: {
          wallet: { decrement: bet },
        },
      });

      // Initialize the race
      const positions = HORSES.map(() => 0);
      const selectedHorse = HORSES[horseNumber];
      let raceFinished = false;
      let winner = null;

      // Announce race countdown
      for (let i = 3; i > 0; i--) {
        await interaction.editReply(`🏁 Race starting in ${i}...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Start the race
      while (!raceFinished) {
        HORSES.forEach((horse, index) => {
          if (Math.random() < 1 / horse.odds) {
            positions[index]++;
          }
          if (positions[index] >= TRACK_LENGTH) {
            raceFinished = true;
            winner = index;
          }
        });

        // Visualize the race track
        const track = HORSES.map((horse, index) => {
          const position = positions[index];
          const safePosition = Math.max(position, 0);
          const safeTrackLength = Math.max(TRACK_LENGTH - safePosition - 1, 0);

          return `${horse.name}: ${'.'.repeat(safePosition)}${horse.name.split(' ')[0]}${'.'.repeat(safeTrackLength)}🏁`;
        }).join('\n');

        await interaction.editReply(`\n🏇 Horse Race 🏇\n${track}`);

        if (!raceFinished) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Determine the winner
      const winningHorse = HORSES[winner];
      const won = winner === horseNumber;
      const winnings = won ? Math.floor(bet * winningHorse.odds) : 0;

      // Update user's balance
      if (won) {
        await prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            wallet: { increment: winnings },
            totalWon: { increment: winnings - bet },
          },
        });
      } else {
        await prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            totalLost: { increment: bet },
          },
        });
      }

      // Announce race result
      await interaction.editReply(`
🏁 **Race Finished!** 🏁
Winner: **${winningHorse.name}**
${won ? `🎉 Congratulations! You won $${winnings}!` : '😢 Better luck next time!'}
      `);
    } catch (error) {
      console.error('Error in HorseRaceCommand:', error);
      return interaction.editReply('⚠️ An error occurred while processing your request.');
    }
  }
}
