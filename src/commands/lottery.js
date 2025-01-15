import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class LotteryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'lottery',
      description: 'Participate in the server lottery'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand(subcommand =>
          subcommand
            .setName('buy')
            .setDescription('Buy lottery tickets')
            .addIntegerOption(option =>
              option
                .setName('tickets')
                .setDescription('Number of tickets to buy')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('info')
            .setDescription('View current lottery information')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Create a new lottery (Admin only)')
            .addIntegerOption(option =>
              option
                .setName('prize')
                .setDescription('Prize pool amount')
                .setRequired(true)
                .setMinValue(100)
            )
            .addIntegerOption(option =>
              option
                .setName('ticket_price')
                .setDescription('Price per ticket')
                .setRequired(true)
                .setMinValue(1)
            )
            .addIntegerOption(option =>
              option
                .setName('duration')
                .setDescription('Duration in hours')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(168)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('draw')
            .setDescription('Draw the lottery winner (Admin only)')
        )
    );
  }

  async chatInputRun(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'buy':
        await this.buyTickets(interaction);
        break;
      case 'info':
        await this.showInfo(interaction);
        break;
      case 'create':
        await this.createLottery(interaction);
        break;
      case 'draw':
        await this.drawWinner(interaction);
        break;
    }
  }

  async buyTickets(interaction) {
    const tickets = interaction.options.getInteger('tickets');
    
    const activeLottery = await prisma.lottery.findFirst({
      where: { active: true }
    });

    if (!activeLottery) {
      return interaction.reply('No active lottery found!');
    }

    const totalCost = tickets * activeLottery.ticketPrice;
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (totalCost > user.wallet) {
      return interaction.reply('Insufficient funds in wallet!');
    }

    // Create tickets
    const ticketPromises = Array(tickets).fill(null).map(() => 
      prisma.lotteryTicket.create({
        data: {
          lottery: { connect: { id: activeLottery.id } },
          user: { connect: { id: user.id } }
        }
      })
    );

    await Promise.all([
      ...ticketPromises,
      prisma.user.update({
        where: { id: user.id },
        data: {
          wallet: { decrement: totalCost }
        }
      })
    ]);

    return interaction.reply(`
🎟️ Lottery Tickets Purchased! 🎟️
Tickets: ${tickets}
Total Cost: $${totalCost}
Good luck!
    `);
  }

  async showInfo(interaction) {
    const lottery = await prisma.lottery.findFirst({
      where: { active: true },
      include: {
        tickets: {
          include: {
            user: true
          }
        }
      }
    });

    if (!lottery) {
      return interaction.reply('No active lottery found!');
    }

    const timeLeft = new Date(lottery.endTime).getTime() - Date.now();
    const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
    
    const userTickets = lottery.tickets.filter(ticket => 
      ticket.userId === interaction.user.id
    ).length;

    return interaction.reply(`
🎰 Current Lottery Information 🎰
Prize Pool: $${lottery.prize}
Ticket Price: $${lottery.ticketPrice}
Total Tickets Sold: ${lottery.tickets.length}
Time Remaining: ${hoursLeft} hours
Your Tickets: ${userTickets}
    `);
  }

  async createLottery(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply('Only administrators can create lotteries!');
    }

    const prize = interaction.options.getInteger('prize');
    const ticketPrice = interaction.options.getInteger('ticket_price');
    const duration = interaction.options.getInteger('duration');

    const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);

    await prisma.lottery.updateMany({
      where: { active: true },
      data: { active: false }
    });

    await prisma.lottery.create({
      data: {
        prize,
        ticketPrice,
        endTime,
        active: true,
        tickets: []
      }
    });

    return interaction.reply(`
🎰 New Lottery Created! 🎰
Prize Pool: $${prize}
Ticket Price: $${ticketPrice}
Duration: ${duration} hours
    `);
  }

  async drawWinner(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply('Only administrators can draw the lottery!');
    }

    const lottery = await prisma.lottery.findFirst({
      where: { active: true },
      include: {
        tickets: {
          include: {
            user: true
          }
        }
      }
    });

    if (!lottery) {
      return interaction.reply('No active lottery found!');
    }

    if (lottery.tickets.length === 0) {
      return interaction.reply('No tickets were sold!');
    }

    const winningTicket = lottery.tickets[Math.floor(Math.random() * lottery.tickets.length)];
    const winnerId = winningTicket.userId;

    // Update lottery status
    await prisma.lottery.update({
      where: { id: lottery.id },
      data: {
        active: false,
        winner: winnerId
      }
    });

    // Award prize to winner
    await prisma.user.update({
      where: { id: winnerId },
      data: {
        wallet: { increment: lottery.prize },
        totalWon: { increment: lottery.prize }
      }
    });

    const winner = await interaction.client.users.fetch(winnerId);
    return interaction.reply(`
🎉 Lottery Winner Drawn! 🎉
Winner: ${winner.username}
Prize: $${lottery.prize}
Total Tickets: ${lottery.tickets.length}
    `);
  }
} 