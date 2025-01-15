import { LogLevel, SapphireClient } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import { GatewayIntentBits, ActivityType } from 'discord.js';
import { config } from 'dotenv';

config();

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  loadMessageCommandListeners: true,
  logger: {
    level: LogLevel.Debug
  }
});

client.once('ready', async () => {
  const { username, id } = client.user;
  console.log(`Logged in as ${username} (${id})`);
  
  try {
    // Get all commands
    const commands = await client.application?.commands.fetch();
    console.log(`Current commands: ${commands?.size ?? 0}`);

    // Force register commands to your server
    const guild = await client.guilds.fetch('1194347543559880754'); // Your server ID
    const guildCommands = await guild.commands.set([
      {
        name: 'slots',
        description: 'Play slots'
      },
      {
        name: 'blackjack',
        description: 'Play blackjack'
      },
      {
        name: 'roulette',
        description: 'Play roulette'
      },
      {
        name: 'baccarat',
        description: 'Play baccarat'
      },
      {
        name: 'crash',
        description: 'Play crash game'
      },
      {
        name: 'minesweeper',
        description: 'Play minesweeper'
      },
      {
        name: 'horserace',
        description: 'Bet on horse races'
      },
      {
        name: 'lottery',
        description: 'Participate in server lottery'
      },
      {
        name: 'bank',
        description: 'Manage your bank account'
      },
      {
        name: 'salary',
        description: 'View and claim your salary'
      }
    ]);

    console.log(`Registered ${guildCommands.size} commands in ${guild.name}`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }

  client.user.setActivity('🎰 Gambling Games', { type: ActivityType.Playing });
});

client.on('error', console.error);

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.DISCORD_TOKEN); 