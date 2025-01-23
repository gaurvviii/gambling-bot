import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '../lib/database.js';

const games = new Map();
const GRID_SIZE = 4;
const MIN_MINES = 1;
const MAX_MINES = 10;

export class MinesweeperCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'minesweeper',
      description: 'Play minesweeper - reveal tiles and avoid mines!'
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addIntegerOption((option) =>
          option
            .setName('bet')
            .setDescription('Amount to bet')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption((option) =>
          option
            .setName('mines')
            .setDescription(`Number of mines (${MIN_MINES}-${MAX_MINES})`)
            .setRequired(false)
            .setMinValue(MIN_MINES)
            .setMaxValue(MAX_MINES)
        )
    );
  }

  createGame(mineCount) {
    const grid = Array(GRID_SIZE * GRID_SIZE).fill(false);
    const mines = new Set();

    while (mines.size < mineCount) {
      const position = Math.floor(Math.random() * grid.length); if (!mines.has(position)) {
        mines.add(position);
        grid[position] = true;
      }
    }

    return {
      grid,
      revealed: new Set(),
      multiplier: 1.0,
      active: true,
      mineCount
    };
  }

  createButtons(gameState) {
    const rows = [];
    // Create 4 rows with 5 buttons each
    for (let i = 0; i < 4; i++) {
      const row = new ActionRowBuilder();
      for (let j = 0; j < GRID_SIZE; j++) {
        const position = i * GRID_SIZE + j;
        const button = new ButtonBuilder()
          .setCustomId(`tile_${position}`)
          .setLabel(gameState.revealed.has(position) ? '✅' : '?')
          .setStyle(gameState.revealed.has(position) ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(gameState.revealed.has(position));
        row.addComponents(button);
      }
      rows.push(row);
    }
    
    // Last row combines the remaining game buttons and cashout button
    const lastRow = new ActionRowBuilder();
    // Add the remaining game buttons (last row)
    for (let j = 0; j < GRID_SIZE; j++) {
      const position = 4 * GRID_SIZE + j;
      const button = new ButtonBuilder()
        .setCustomId(`tile_${position}`)
        .setLabel(gameState.revealed.has(position) ? '✅' : '?')
        .setStyle(gameState.revealed.has(position) ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(gameState.revealed.has(position));
      lastRow.addComponents(button);
    }

    // Add the cashout button to the last row
    lastRow.addComponents(
      new ButtonBuilder()
        .setCustomId('cashout')
        .setLabel('Cash Out')
        .setStyle(ButtonStyle.Danger)
    );
    
    rows.push(lastRow);
    return rows;
  }

  calculateMultiplierIncrement(mineCount) {
    // Higher mine count = higher risk = higher reward
    return 0.1 + (mineCount * 0.05);
  }

  async chatInputRun(interaction) {
    try {
      const userId = interaction.user.id;
      const existingGame = games.get(userId);
      
      if (existingGame && existingGame.active) {
        return interaction.reply('You already have a game in progress!');
      }

      const bet = interaction.options.getInteger('bet');
      const mineCount = interaction.options.getInteger('mines') || 3; // Default to 3 mines if not specified

      if (mineCount < MIN_MINES || mineCount > MAX_MINES) {
        return interaction.reply(`Mine count must be between ${MIN_MINES} and ${MAX_MINES}!`);
      }

      // Get or create user automatically
      let user = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Auto-register if user doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            wallet: 0,
            bank: 1000,
            hoursEarned: 0
          }
        });
      }

      if (bet > user.wallet) {
        return interaction.reply('Insufficient funds in wallet!');
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          wallet: { decrement: bet }
        }
      });

      const gameState = this.createGame(mineCount);
      games.set(userId, {
        ...gameState,
        bet
      });

      const response = await interaction.reply({
        content: this.getGameState(bet, gameState.multiplier, mineCount),
        components: this.createButtons(gameState)
      });

      const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === userId,
        time: 60000
      });

      collector.on('collect', async (i) => {
        const game = games.get(userId);
        if (!game || !game.active) return;

        if (i.customId === 'cashout') {
          const winnings = Math.floor(bet * game.multiplier);
          await this.endGame(i, userId, winnings);
          collector.stop();
          return;
        }

        const position = parseInt(i.customId.split('_')[1]);
        game.revealed.add(position);

        if (game.grid[position]) {
          // Hit a mine
          await this.endGame(i, userId, 0);
          collector.stop();
          return;
        }

        game.multiplier += this.calculateMultiplierIncrement(game.mineCount);
        await i.update({
          content: this.getGameState(bet, game.multiplier, game.mineCount),
          components: this.createButtons(game)
        });
      });

      collector.on('end', async (collected, reason) => {
        const game = games.get(userId);
        if (reason === 'time' && game?.active) {
          game.active = false;
          await interaction.editReply({
            content: 'Game expired!',
            components: []
          });
        }
      });
    } catch (error) {
      console.error('Error in minesweeper game:', error);
      return interaction.reply('An error occurred while starting the game. Please try again.');
    }
  }

  getGameState(bet, multiplier, mineCount) {
    return `
💣 Minesweeper 💣
Bet: $${bet}
Mines: ${mineCount}
Current Multiplier: ${multiplier.toFixed(1)}x
Potential Win: $${Math.floor(bet * multiplier)}
    `;
  }

  async endGame(interaction, userId, winnings) {
    const game = games.get(userId);
    if (!game || !game.active) return;
    
    game.active = false;

    try {
      if (winnings > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            wallet: { increment: winnings },
            totalWon: { increment: winnings - game.bet }
          }
        });

        await interaction.update({
          content: `
💰 You won $${winnings}!
Final multiplier: ${game.multiplier.toFixed(1)}x`,
          components: []
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalLost: { increment: game.bet }
          }
        });

        await interaction.update({
          content: `
💥 BOOM! You hit a mine!
You lost $${game.bet}!`,
          components: []
        });
      }
    } catch (error) {
      console.error('Error ending game:', error);
      await interaction.update({
        content: 'An error occurred while ending the game.',
        components: []
      });
    } finally {
      games.delete(userId);
    }
  }
}