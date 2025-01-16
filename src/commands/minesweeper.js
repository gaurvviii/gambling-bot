import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '../lib/database.js';

const games = new Map();
const GRID_SIZE = 5;
const DEFAULT_MINES = 3;

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
    );
  }

  createGame() {
    const grid = Array(GRID_SIZE * GRID_SIZE).fill(false);
    const mines = new Set();

    while (mines.size < DEFAULT_MINES) {
      const position = Math.floor(Math.random() * grid.length);
      if (!mines.has(position)) {
        mines.add(position);
        grid[position] = true;
      }
    }

    return {
      grid,
      revealed: new Set(),
      multiplier: 1.0,
      active: true
    };
  }

  createButtons(gameState) {
    const rows = [];
    for (let i = 0; i < GRID_SIZE; i++) {
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
    
    const cashoutRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('cashout')
        .setLabel('Cash Out')
        .setStyle(ButtonStyle.Danger)
    );
    rows.push(cashoutRow);

    return rows;
  }

  async chatInputRun(interaction) {
    const userId = interaction.user.id;
    const existingGame = games.get(userId);
    
    if (existingGame && existingGame.active) {
      return interaction.reply('You already have a game in progress!');
    }

    const bet = interaction.options.getInteger('bet');
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (bet > user.wallet) {
      return interaction.reply('Insufficient funds in wallet!');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        wallet: { decrement: bet }
      }
    });

    const gameState = this.createGame();
    games.set(userId, {
      ...gameState,
      bet
    });

    const response = await interaction.reply({
      content: this.getGameState(bet, gameState.multiplier),
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

      game.multiplier += 0.2;
      await i.update({
        content: this.getGameState(bet, game.multiplier),
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
  }

  getGameState(bet, multiplier) {
    return `
💣 Minesweeper 💣
Bet: $${bet}
Current Multiplier: ${multiplier.toFixed(1)}x
Potential Win: $${Math.floor(bet * multiplier)}
    `;
  }

  async endGame(interaction, userId, winnings) {
    const game = games.get(userId);
    if (!game || !game.active) return;
    
    game.active = false;

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
  }
}