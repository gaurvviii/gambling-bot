import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const GRID_SIZE = 5; // 5x5 grid

export class MinesweeperCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'minesweeper',
      description: 'Play Minesweeper',
    });
  }

  async registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addIntegerOption(option =>
          option.setName('bet')
            .setDescription('Amount to bet')
            .setRequired(true)
            .setMinValue(1))
        .addIntegerOption(option =>
          option.setName('mines')
            .setDescription('Number of mines (1-5)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(5))
    );
  }

  async chatInputRun(interaction) {
    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    if (!user) {
      return interaction.reply('You need to register first! Use /register');
    }

    const bet = interaction.options.getInteger('bet');
    const minesCount = interaction.options.getInteger('mines');

    if (user.wallet < bet) {
      return interaction.reply('You do not have enough money in your wallet to place this bet!');
    }

    // Deduct the bet amount from the user's wallet
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wallet: { decrement: bet }
      }
    });

    // Initialize the game with random mine placement
    const grid = this.initializeGrid(minesCount);
    const buttons = this.createButtons(grid);
    const safeCells = GRID_SIZE * GRID_SIZE - minesCount; // Total safe cells

    const row = new ActionRowBuilder().addComponents(buttons);
    await interaction.reply({ content: 'Minesweeper Game Started! Click a button to reveal:', components: [row] });

    // Handle button interactions
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

    let revealedCells = 0; // Track revealed safe cells

    collector.on('collect', async i => {
      const { customId } = i;
      const [row, col] = customId.split('-').map(Number);

      if (grid[row][col] === '💣') {
        // User hit a mine
        buttons[row * GRID_SIZE + col].setLabel('💣').setStyle(ButtonStyle.Danger).setDisabled(true);
        await interaction.editReply({ components: [new ActionRowBuilder().addComponents(buttons)] });
        await i.reply({ content: 'Game Over! You hit a mine!', ephemeral: true });
        collector.stop();
      } else {
        // Safe cell revealed
        revealedCells++;
        const adjacentMines = this.countAdjacentMines(grid, row, col);
        buttons[row * GRID_SIZE + col].setLabel(adjacentMines > 0 ? `${adjacentMines}` : '✅').setStyle(ButtonStyle.Success).setDisabled(true);
        await interaction.editReply({ components: [new ActionRowBuilder().addComponents(buttons)] });
        await i.reply({ content: 'Safe! You revealed a cell.', ephemeral: true });

        // Check for win condition
        if (revealedCells === safeCells) {
          const multiplier = this.calculateMultiplier(minesCount);
          const winnings = Math.floor(bet * multiplier);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              wallet: { increment: winnings },
              totalWon: { increment: winnings }
            }
          });
          await interaction.followUp(`Congratulations! You revealed all safe cells! You won $${winnings}!`);
          collector.stop();
        }
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.followUp('Time is up! Game ended.');
      }
    });
  }

  initializeGrid(minesCount) {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    let minesPlaced = 0;

    while (minesPlaced < minesCount) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);

      if (grid[row][col] !== '💣') {
        grid[row][col] = '💣';
        minesPlaced++;
      }
    }

    return grid;
  }

  createButtons(grid) {
    const buttons = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        buttons.push(new ButtonBuilder()
          .setCustomId(`${row}-${col}`)
          .setLabel('❓')
          .setStyle(ButtonStyle.Primary));
      }
    }
    return buttons;
  }

  countAdjacentMines(grid, row, col) {
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], /* cell */ [0, 1],
      [1, -1], [1, 0], [1, 1],
    ];
    let count = 0;

    for (const [dx, dy] of directions) {
      const newRow = row + dx;
      const newCol = col + dy;
      if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
        if (grid[newRow][newCol] === '💣') count++;
      }
    }
    return count;
  }

  calculateMultiplier(minesCount) {
    const multipliers = {
      1: 5,
      2: 3,
      3: 2,
      4: 1.5,
      5: 1
    };
    return multipliers[minesCount] || 1; // Default to 1 if not found
  }
}
