import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class LeaderboardCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'leaderboard',
            description: 'View the gambling leaderboards'
        });
    }
    async messageRun(message, args) {
        const type = await args.pick('string').catch(() => 'balance');
        let users;
        let title;
        let valueField;
        switch (type.toLowerCase()) {
            case 'gambled':
                users = await prisma.user.findMany({
                    orderBy: { totalGambled: 'desc' },
                    take: 10
                });
                title = '🎲 Top Gamblers';
                valueField = 'totalGambled';
                break;
            case 'lost':
                users = await prisma.user.findMany({
                    orderBy: { totalLost: 'desc' },
                    take: 10
                });
                title = '📉 Biggest Losers';
                valueField = 'totalLost';
                break;
            default:
                users = await prisma.user.findMany({
                    orderBy: {
                        wallet: 'desc'
                    },
                    take: 10
                });
                title = '💰 Richest Players';
                valueField = 'wallet';
        }
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#00ff00');
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            try {
                const discordUser = await message.client.users.fetch(user.id);
                embed.addFields({
                    name: `${i + 1}. ${discordUser.username}`,
                    value: `$${user[valueField].toFixed(2)}`,
                    inline: false
                });
            }
            catch (error) {
                console.error(`Could not fetch user ${user.id}`);
            }
        }
        return message.reply({ embeds: [embed] });
    }
}
