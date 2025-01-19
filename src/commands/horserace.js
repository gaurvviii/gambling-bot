import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { getUser } from '../lib/user.js'; 


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
      description: 'Bet on horse races'
    });
  }
  
  async chatInputRun(interaction) {
    await interaction.deferReply();
  
    const bet = interaction.options.getInteger('bet');
    const horseNumber = interaction.options.getInteger('horse') - 1;
  
    // Use the getUser function to retrieve the user
    const user = await getUser(interaction.user.id);
  
    if (!user) {
      return interaction.editReply({
        content: 'You need to register first!',
        ephemeral: true,
      });
    }
  
    if (bet > user.wallet) {
      return interaction.editReply('Insufficient funds in wallet!');
    }
  
    // Deduct bet
    await prisma.user.update({
      where: { id: interaction.user.id },
      data: {
        wallet: { decrement: bet }
      }
    });
  
    const positions = HORSES.map(() => 0);
    const selectedHorse = HORSES[horseNumber];
    let raceFinished = false;
    let winner = null;
  
    await interaction.editReply('🏁 Race starting in 3...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await interaction.editReply('🏁 Race starting in 2...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await interaction.editReply('🏁 Race starting in 1...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  
    while (!raceFinished) {
      // Move horses
      HORSES.forEach((horse, index) => {
        if (Math.random() < 1 / horse.odds) {
          positions[index]++;
        }
        if (positions[index] >= TRACK_LENGTH) {
          raceFinished = true;
          winner = index;
        }
      });
  
      // Create race track visualization
      const track = HORSES.map((horse, index) => {
        const position = positions[index];
        const safePosition = Math.max(position, 0);
        const safeTrackLength = Math.max(TRACK_LENGTH - safePosition - 1, 0);
  
        return `${horse.name}: ${'.'.repeat(safePosition)}${horse.name.split(' ')[0]}${'.'.repeat(safeTrackLength)}🏁`;
      }).join('\n');
  
      await interaction.editReply(`
  🏇 Horse Race 🏇
  ${track}
      `);
  
      if (!raceFinished) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  
    const winningHorse = HORSES[winner];
    const won = winner === horseNumber;
    const winnings = won ? Math.floor(bet * winningHorse.odds) : 0;
  
    // Update user's balance
    if (won) {
      await prisma.user.update({
        where: { id: interaction.user.id },
        data: {
          wallet: { increment: winnings },
          totalWon: { increment: winnings - bet }
        }
      });
    } else {
      await prisma.user.update({
        where: { id: interaction.user.id },
        data: {
          totalLost: { increment: bet }
        }
      });
    }
  
    await interaction.editReply(`
  🏇 Race Finished! 🏇
  Winner: ${winningHorse.name}
  ${won ? `Congratulations! You won $${winnings}!` : 'Better luck next time!'}
    `);
  }
}