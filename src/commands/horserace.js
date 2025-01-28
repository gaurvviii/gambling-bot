import { Command } from "@sapphire/framework";
import { prisma } from "../lib/database.js";
import { GAMBLING_CHANNEL_ID } from "../config/constants.js";

const HORSES = [
  { name: '🐎 Thunderbolt' },
  { name: '🐎 Shadow Runner' },
  { name: '🐎 Lucky Star' },
  { name: '🐎 Silver Wind' },
  { name: '🐎 Golden Flash' }
];

const TRACK_LENGTH = 15;

export class HorseRaceCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: "horserace",
            description: "Bet on horse races",
        });
    }

    async registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addIntegerOption((option) =>
                    option
                        .setName("bet")
                        .setDescription("Amount to bet")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("horse")
                        .setDescription("Horse number (1-5)")
                        .setRequired(true)
                )
        );
    }

    async chatInputRun(interaction) {
        try {
            // Restrict command to the gambling channel
            if (interaction.channelId !== GAMBLING_CHANNEL_ID) {
                return interaction.reply({
                    content:
                        "⚠️ This command can only be used in the gambling channel!",
                    ephemeral: true,
                });
            }

      // Defer the reply
      await interaction.deferReply({ ephemeral: true });

            // Parse inputs
            const bet = interaction.options.getInteger("bet");
            const horseNumber = interaction.options.getInteger("horse") - 1;

            // Validate inputs
            if (!bet || bet <= 0) {
                return interaction.editReply(
                    "⚠️ Please enter a valid bet amount."
                );
            }
            if (horseNumber < 0 || horseNumber >= HORSES.length) {
                return interaction.editReply(
                    "⚠️ Please select a valid horse number (1-5)."
                );
            }

            // Fetch or create the user
            let user = await prisma.user.findUnique({
                where: { id: interaction.user.id },
            });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: interaction.user.id,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0,
          },
        });
      }

            // Check if the user has sufficient funds
            if (bet > user.wallet) {
                return interaction.editReply(
                    "⚠️ You do not have enough funds in your wallet!"
                );
            }

            // Deduct the bet amount from the user's wallet
            await prisma.user.update({
                where: { id: interaction.user.id },
                data: {
                    wallet: { decrement: bet },
                },
            });

      // Initialize the race
      const positions = HORSES.map(() => 0);
      let raceFinished = false;
      let winner = null;

      // Pre-determine the winner randomly
      const winningHorseIndex = Math.floor(Math.random() * HORSES.length);
      
      // Start the race
      while (!raceFinished) {
        // Give the winning horse a slightly higher chance to advance
        for (let i = 0; i < HORSES.length; i++) {
          const moveChance = Math.random();
          if (i === winningHorseIndex) {
            if (moveChance > 0.4) positions[i]++; // 60% chance to move
          } else {
            if (moveChance > 0.5) positions[i]++; // 50% chance to move
          }
        }

        // Check if winning horse reached the finish
        if (positions[winningHorseIndex] >= TRACK_LENGTH) {
          raceFinished = true;
          winner = winningHorseIndex;
        }

                // Visualize the race track
                const track = HORSES.map((horse, index) => {
                    const position = positions[index];
                    const safePosition = Math.max(position, 0);
                    const safeTrackLength = Math.max(
                        TRACK_LENGTH - safePosition - 1,
                        0
                    );

                    return `${horse.name}: ${".".repeat(safePosition)}${
                        horse.name.split(" ")[0]
                    }${".".repeat(safeTrackLength)}🏁`;
                }).join("\n");

                await interaction.editReply(`\n🏇 Horse Race 🏇\n${track}`);

                if (!raceFinished) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }

      // Determine the winner
      const winningHorse = HORSES[winner];
      const won = winner === horseNumber;
      const winnings = won ? Math.floor(bet * 2) : 0;

            // Update user's balance
            if (won) {
                await prisma.user.update({
                    where: { id: interaction.user.id },
                    data: {
                        wallet: { increment: winnings },
                        totalWon: { increment: winnings - bet },
                    },
                });
            } else {
                await prisma.user.update({
                    where: { id: interaction.user.id },
                    data: {
                        totalLost: { increment: bet },
                    },
                });
            }

            // Announce race result
            await interaction.editReply(`
🏁 **Race Finished!** 🏁
Winner: **${winningHorse.name}**
${won ? `🎉 Congratulations! You won $${winnings}!` : 'You Lost😢 Better luck next time!'}
      `);
        } catch (error) {
            console.error("Error in HorseRaceCommand:", error);
            return interaction.editReply(
                "⚠️ An error occurred while processing your request."
            );
        }
    }
}
