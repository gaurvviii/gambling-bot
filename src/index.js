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
    const guild = await client.guilds.fetch('1325400597117009971'); // done 
    const guildCommands = await guild.commands.set([
      {
        name: 'slots',
        description: 'Play slots! Bet an amount and try your luck'
      },
      {
        name: 'blackjack',
        description: 'Play a game of blackjack'
      },
      {
        name: 'roulette',
        description: 'Play roulette with various betting options'
      },
      {
        name: 'baccarat',
        description: 'Play baccarat - bet on Player, Banker, or Tie'
      },
      {
        name: 'crash',
        description: 'Play crash game - bet and cash out before it crashes!'
      },
      {
        name: 'minesweeper',
        description: 'Play minesweeper - reveal tiles and avoid mines!'
      },
      {
        name: 'horserace',
        description: 'Bet on horse races and watch them compete'
      },
      {
        name: 'wheel',
        description: 'Spin the Wheel of Fortune'
      },
      {
        name: 'rps',
        description: 'Play Rock-Paper-Scissors against bot or other players'
      },
      {
        name: 'bank',
        description: 'Manage your bank account'
      },
      {
        name: 'transfer',
        description: 'Transfer money between bank and wallet'
      },
      {
        name: 'leaderboard',
        description: 'View various gambling leaderboards'
      },
      {
        name: 'fixbalance',
        description: 'Admin command to fix user balance'
      }
    ]);

    console.log(`Successfully registered ${guildCommands.size} commands in ${guild.name}`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }

  client.user.setActivity('🎰 Gambling Games', { type: ActivityType.Playing });
});

// Handle command errors
client.on('chatInputCommandError', (error) => {
  console.error('Command error:', error);
});

// Handle interaction errors
client.on('interactionError', (error) => {
  console.error('Interaction error:', error);
});

// Handle general errors
client.on('error', (error) => {
  console.error('Client error:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await client.destroy();
  process.exit(0);
});

// Login with error handling
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('Failed to login:', error);
  process.exit(1);
});