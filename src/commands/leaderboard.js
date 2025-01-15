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
        .addStringOption(option =>
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
    const type = interaction.options.getString('type');
    let users;
    let title;
    let description;

    switch (type) {
      case 'wealth':
        users = await prisma.user.findMany({
          orderBy: [
            {
              wallet: 'desc'
            },
            {
              bank: 'desc'
            }
          ],
          take: 10
        });
        
        title = '💰 Wealthiest Gamblers';
        description = await this.formatWealthLeaderboard(users, interaction.client);
        break;

      case 'won':
        users = await prisma.user.findMany({
          orderBy: {
            totalWon: 'desc'
          },
          take: 10
        });
        
        title = '🎰 Biggest Winners';
        description = await this.formatWinLossLeaderboard(users, interaction.client, 'totalWon');
        break;

      case 'lost':
        users = await prisma.user.findMany({
          orderBy: {
            totalLost: 'desc'
          },
          take: 10
        });
        
        title = '📉 Biggest Losers';
        description = await this.formatWinLossLeaderboard(users, interaction.client, 'totalLost');
        break;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#FFD700')
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  async formatWealthLeaderboard(users, client) {
    let description = '';
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const discordUser = await client.users.fetch(user.id);
      const total = user.wallet + user.bank;
      description += `${i + 1}. ${discordUser.username}\n`;
      description += `   💵 Total: $${total.toLocaleString()}\n`;
      description += `   (Wallet: $${user.wallet.toLocaleString()} | Bank: $${user.bank.toLocaleString()})\n\n`;
    }
    return description || 'No users found';
  }

  async formatWinLossLeaderboard(users, client, field) {
    let description = '';
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const discordUser = await client.users.fetch(user.id);
      description += `${i + 1}. ${discordUser.username}\n`;
      description += `   💵 ${field === 'totalWon' ? 'Won' : 'Lost'}: $${user[field].toLocaleString()}\n\n`;
    }
    return description || 'No users found';
  }
} 