import { prisma } from './database.js'; 

async function drawExpiredLotteries() {
  const currentTime = new Date();
  
  // Find all active lotteries that have expired
  const expiredLotteries = await prisma.lottery.findMany({
    where: {
      active: true,
      endTime: {
        lte: currentTime,
      },
    },
    include: {
      tickets: {
        select: {
          userId: true,
        },
      },
    },
  });

  for (const lottery of expiredLotteries) {
    if (lottery.tickets.length === 0) {
      // If no tickets were sold, just deactivate the lottery
      await prisma.lottery.update({
        where: { id: lottery.id },
        data: { active: false },
      });
      continue;
    }
    // Randomly select a winner
    const winnerTicket = lottery.tickets[Math.floor(Math.random() * lottery.tickets.length)];
    
    // Update the lottery to inactive
    await prisma.lottery.update({
      where: { id: lottery.id },
      data: { active: false },
    });

    // Update the winner's wallet
    await prisma.user.update({
      where: { id: winnerTicket.userId },
      data: { wallet: { increment: lottery.prize } },
    });

    console.log(`🎉 Lottery Winner: <@${winnerTicket.userId}> has won $${lottery.prize} from lottery ID: ${lottery.id}!`);
  }
}

// Set an interval to check for expired lotteries every minute
setInterval(drawExpiredLotteries, 60000); 

export function generateShortId() {
  return Math.random().toString(36).substring(2, 7);  // Generates a random string of 5 characters
}