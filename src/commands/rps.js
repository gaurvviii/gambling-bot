import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';
import { ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { GAMBLING_CHANNEL_ID } from '../config/constants.js';

const CHOICES = ['rock', 'paper', 'scissors'];
const EMOJIS = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️'
};

export class RPSCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'rps',
      description: 'Play Rock-Paper-Scissors'
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
        .addUserOption((option) =>
          option
            .setName('opponent')
            .setDescription('User to play against (leave empty to play against bot)')
            .setRequired(false)
        )
    );
  }

  async chatInputRun(interaction) {
        // Check if the interaction is in the correct channel
        if (interaction.channel.id !== GAMBLING_CHANNEL_ID) {
          return interaction.reply('You can only play Rock-Paper-Scissors in the gambling channel!');
        }

    const bet = interaction.options.getInteger('bet');
    const opponent = interaction.options.getUser('opponent');
    
    // Get or create user automatically
    let user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });

    // Auto-register if user doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: interaction.user.id,
          wallet: 0,
          bank: 1000,
          hoursEarned: 0
        }
      });
    }

    if (user.wallet < bet) {
      return interaction.reply('Insufficient funds in wallet!');
    }

    if (opponent) {
      return this.playVsUser(interaction, bet, opponent);
    } else {
      return this.playVsBot(interaction, bet);
    }
  }

  async playVsBot(interaction, bet) {
    const buttons = CHOICES.map(choice => 
      new ButtonBuilder()
        .setCustomId(choice)
        .setLabel(choice.toUpperCase())
        .setEmoji(EMOJIS[choice])
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    const response = await interaction.reply({
      content: '🎮 Choose your move!',
      components: [row]
    });

    try {
      const confirmation = await response.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        time: 30000,
        componentType: ComponentType.Button
      });

      const playerChoice = confirmation.customId;
      const botChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
      
      const result = this.determineWinner(playerChoice, botChoice);
      const winnings = result === 'win' ? bet * 2 : 0;

      // Update balances
      await prisma.user.update({
        where: { id: interaction.user.id },
        data: {
          wallet: { increment: winnings - bet },
          totalWon: { increment: result === 'win' ? winnings - bet : 0 },
          totalLost: { increment: result === 'lose' ? bet : 0 }
        }
      });

      await confirmation.update({
        content: `
🎮 Rock Paper Scissors 🎮
You chose: ${EMOJIS[playerChoice]} ${playerChoice}
Bot chose: ${EMOJIS[botChoice]} ${botChoice}
${result === 'win' ? `You won $${winnings}!` : result === 'lose' ? 'You lost!' : 'It\'s a tie! Your bet was returned.'}
        `,
        components: []
      });

    } catch (e) {
      await interaction.editReply({
        content: 'Game cancelled - no response within 30 seconds!',
        components: []
      });
    }
  }

  async playVsUser(interaction, bet, opponent) {
    if (opponent.bot) {
      return interaction.reply('You cannot challenge a bot!');
    }

    if (opponent.id === interaction.user.id) {
      return interaction.reply('You cannot challenge yourself!');
    }

    // Get or create both users
    let [user, opponentUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: interaction.user.id } }),
      prisma.user.findUnique({ where: { id: opponent.id } })
    ]);

    // Auto-register if either user doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: interaction.user.id,
          wallet: 0,
          bank: 1000,
          hoursEarned: 0
        }
      });
    }

    if (!opponentUser) {
      opponentUser = await prisma.user.create({
        data: {
          id: opponent.id,
          wallet: 0,
          bank: 1000,
          hoursEarned: 0
        }
      });
    }

    if (user.wallet < bet || opponentUser.wallet < bet) {
      return interaction.reply('One or both players have insufficient funds!');
    }

    const buttons = CHOICES.map(choice => 
      new ButtonBuilder()
        .setCustomId(choice)
        .setLabel(choice.toUpperCase())
        .setEmoji(EMOJIS[choice])
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    const response = await interaction.reply({
      content: `${opponent}, you've been challenged to RPS for $${bet}! Choose your move:`,
      components: [row]
    });

    try {
      const choices = new Map();
      
      for (const player of [interaction.user, opponent]) {
        const confirmation = await response.awaitMessageComponent({
          filter: i => i.user.id === player.id && !choices.has(player.id),
          time: 30000,
          componentType: ComponentType.Button
        });

        choices.set(player.id, confirmation.customId);
        await confirmation.reply({
          content: `Move registered!`,
          ephemeral: true
        });
      }

      const result = this.determineWinner(
        choices.get(interaction.user.id),
        choices.get(opponent.id)
      );

      // Update balances
      if (result === 'win') {
        await prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            wallet: { increment: bet },
            totalWon: { increment: bet }
          }
        });
        await prisma.user.update({
          where: { id: opponent.id },
          data: {
            wallet: { decrement: bet },
            totalLost: { increment: bet }
          }
        });
      } else if (result === 'lose') {
        await prisma.user.update({
          where: { id: opponent.id },
          data: {
            wallet: { increment: bet },
            totalWon: { increment: bet }
          }
        });
        await prisma.user.update({
          where: { id: interaction.user.id },
          data: {
            wallet: { decrement: bet },
            totalLost: { increment: bet }
          }
        });
      }

      await interaction.editReply({
        content: `
🎮 Rock Paper Scissors 🎮
${interaction.user}: ${EMOJIS[choices.get(interaction.user.id)]}
${opponent}: ${EMOJIS[choices.get(opponent.id)]}
${result === 'win' ? `${interaction.user} wins $${bet}!` : 
  result === 'lose' ? `${opponent} wins $${bet}!` : 
  'It\'s a tie! Bets returned.'}
        `,
        components: []
      });

    } catch (e) {
      await interaction.editReply({
        content: 'Game cancelled - no response within 30 seconds!',
        components: []
      });
    }
  }

  determineWinner(choice1, choice2) {
    if (choice1 === choice2) return 'tie';
    if (
      (choice1 === 'rock' && choice2 === 'scissors') ||
      (choice1 === 'paper' && choice2 === 'rock') ||
      (choice1 === 'scissors' && choice2 === 'paper')
    ) {
      return 'win';
    }
    return 'lose';
  }
}