import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { EmbedBuilder } from 'discord.js';

export class LeaderboardCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'leaderboard',
      description: 'View various gambling leaderboards'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Type of leaderboard to view')
            .setRequired(true)
            .addChoices(
              { name: 'Total Wealth', value: 'wealth' },
              { name: 'Most Won', value: 'won' },
              { name: 'Most Lost', value: 'lost' }
            )
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();

    // Get or create user automatically
    let user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    // Auto-register if user doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: interaction.user.id,
          wallet: 0,
          bank: 1000,
          hoursEarned: 0
        }
      });
    }

    const type = interaction.options.getString('type');
    let users;
    let title;
    let description;

    try {
      switch (type) {
        case 'wealth':
          users = await prisma.user.findMany({
            orderBy: [{ wallet: 'desc' }, { bank: 'desc' }],
            take: 10
          });
          title = '💰 Wealthiest Gamblers';
          description = await this.formatWealthLeaderboard(users, interaction.client);
          break;

        case 'won':
          users = await prisma.user.findMany({
            orderBy: { totalWon: 'desc' },
            take: 10
          });
          title = '🎰 Biggest Winners';
          description = await this.formatWinLossLeaderboard(users, interaction.client, 'totalWon');
          break;

        case 'lost':
          users = await prisma.user.findMany({
            orderBy: { totalLost: 'desc' },
            take: 10
          });
          title = '📉 Biggest Losers';
          description = await this.formatWinLossLeaderboard(users, interaction.client, 'totalLost');
          break;

        default:
          throw new Error('Invalid leaderboard type');
      }
    } catch (error) {
      return interaction.editReply({
        content: 'An error occurred while fetching the leaderboard. Please try again later.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#FFD700')
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  async formatWealthLeaderboard(users, client) {
    const lines = await Promise.all(
      users.map(async (user, i) => {
        try {
          const discordUser = await client.users.fetch(user.id);
          const total = user.wallet + user.bank;
          return `${i + 1}. ${discordUser.username}\n   💵 Total: $${total.toLocaleString()} (Wallet: $${user.wallet.toLocaleString()} | Bank: $${user.bank.toLocaleString()})\n`;
        } catch {
          return `${i + 1}. [Unknown User]\n   💵 Total: $${(user.wallet + user.bank).toLocaleString()} (Wallet: $${user.wallet.toLocaleString()} | Bank: $${user.bank.toLocaleString()})\n`;
        }
      })
    );
    return lines.join('\n') || 'No users found';
  }

  async formatWinLossLeaderboard(users, client, field) {
    const lines = await Promise.all(
      users.map(async (user, i) => {
        try {
          const discordUser = await client.users.fetch(user.id);
          return `${i + 1}. ${discordUser.username}\n   💵 ${field === 'totalWon' ? 'Won' : 'Lost'}: $${user[field].toLocaleString()}\n`;
        } catch {
          return `${i + 1}. [Unknown User]\n   💵 ${field === 'totalWon' ? 'Won' : 'Lost'}: $${user[field].toLocaleString()}\n`;
        }
      })
    );
    return lines.join('\n') || 'No users found';
  }
}