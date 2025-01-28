import { LogLevel, SapphireClient } from "@sapphire/framework";
import "@sapphire/plugin-logger/register";
import { GatewayIntentBits, ActivityType } from "discord.js";
import { config } from "dotenv";
import { SalaryCronJob } from "./jobs/salarycronjobs.js";

config();

const client = new SapphireClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    loadMessageCommandListeners: true,
    logger: {
        level: LogLevel.Debug,
    },
});

client.once("ready", async () => {
    const { username, id } = client.user;
    console.log(`Logged in as ${username} (${id})`);

    try {
        // Fetch all global commands
        const globalCommands = await client.application?.commands.fetch();
        await client.application.commands.set([]);
        console.log(`Current global commands: ${globalCommands?.size ?? 0}`);

        // Fetch the guild you want to register the commands in
        const guild = await client.guilds.fetch("1325400597117009971"); // done

        const guildCommands = await guild.commands.set([]);
        console.log(
            `Successfully registered ${guildCommands.size} commands in ${guild.name}`
        );
    } catch (error) {
        console.error("Error registering commands:", error);
    }

    client.user.setActivity("🎰 Gambling Games", {
        type: ActivityType.Playing,
    });

    // Start the salary cron job
    new SalaryCronJob(client);
});

// Handle command errors
client.on("chatInputCommandError", (error) => {
    console.error("Command error:", error);
});

// Handle interaction errors
client.on("interactionError", (error) => {
    console.error("Interaction error:", error);
});

// Handle general errors
client.on("error", (error) => {
    console.error("Client error:", error);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await client.destroy();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    await client.destroy();
    process.exit(0);
});

// Login with error handling
client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error("Failed to login:", error);
    process.exit(1);
});
