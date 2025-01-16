import { Command } from '@sapphire/framework';
import { getUser } from '../lib/user.js';  
import { prisma } from '../lib/database.js';  

export class LotteryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'lottery',
      description: 'Buy a lottery ticket and participate in a lottery draw.'
    });
  }

  async chatInputRun(interaction) {
    const userId = interaction.user.id;

    // Use getUser function to fetch user data
    const user = await getUser(userId);

    if (!user) {
      return interaction.reply('You need to create an account first!');
    }

    const ticketPrice = 20; // Set ticket price
    if (user.wallet < ticketPrice) {
      return interaction.reply('Insufficient funds in wallet!');
    }

    // Deduct ticket price from the user's wallet
    await prisma.user.update({
      where: { id: userId },
      data: {
        wallet: { decrement: ticketPrice }
      }
    });

    // Fetch the active lottery
    const activeLottery = await prisma.lottery.findFirst({
      where: { active: true, endTime: { gt: new Date() } }  // Check for active lotteries with an end time in the future
    });

    if (!activeLottery) {
      return interaction.reply('No active lottery found at the moment!');
    }

    // Create a lottery ticket for the user
    const lotteryTicket = await prisma.lotteryTicket.create({
      data: {
        userId: userId,
        lotteryId: activeLottery.id,  // Use the dynamic lottery ID
      }
    });

    // Respond to the user with the ticket ID
    await interaction.reply(`You have successfully purchased a lottery ticket! Ticket ID: ${lotteryTicket.id}`);
  }
}
