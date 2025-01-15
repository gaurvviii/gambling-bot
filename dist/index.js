import { LogLevel, SapphireClient } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import { GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
config();
const client = new SapphireClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    logger: {
        level: LogLevel.Debug
    }
});
client.login(process.env.DISCORD_TOKEN);
