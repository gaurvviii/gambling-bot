import { Command } from '@sapphire/framework';
import { prisma } from '../lib/database.js';

export class BaccaratCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'baccarat',
      description: 'Play baccarat'
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
        .addStringOption((option) =>
          option
            .setName('position')
            .setDescription('Choose your bet position')
            .setRequired(true)
            .addChoices(
              { name: 'Player (1:1)', value: 'player' },
              { name: 'Banker (0.95:1)', value: 'banker' },
              { name: 'Tie (8:1)', value: 'tie' }
            )
        )
    );
  }

  drawCard() {
    const value = Math.floor(Math.random() * 13) + 1;
    return value > 10 ? 0 : value;
  }

  calculateTotal(hand) {
    return hand.reduce((sum, card) => (sum + card) % 10, 0);
  }

  async chatInputRun(interaction) {
    const bet = interaction.options.getInteger('bet');
    const position = interaction.options.getString('position');

    const user = await prisma.user.findUnique({
      where: { id: interaction.user.id }
    });
    
    if (!user) {
      return interaction.reply({
        content: 'You need to register first!',
        ephemeral: true,
      });
    }
    
    if (bet > user.wallet) {
      return interaction.reply('Insufficient funds in wallet!');
    }

    // Initial deal
    const playerHand = [this.drawCard(), this.drawCard()];
    const bankerHand = [this.drawCard(), this.drawCard()];
    let playerTotal = this.calculateTotal(playerHand);
    let bankerTotal = this.calculateTotal(bankerHand);

    // Third card rules
    if (playerTotal < 8 && bankerTotal < 8) {
      // Player's third card
      if (playerTotal <= 5) {
        const thirdCard = this.drawCard();
        playerHand.push(thirdCard);
        playerTotal = this.calculateTotal(playerHand);

        // Banker's third card rules
        if (bankerTotal <= 2 || 
            (bankerTotal === 3 && thirdCard !== 8) ||
            (bankerTotal === 4 && [2,3,4,5,6,7].includes(thirdCard)) ||
            (bankerTotal === 5 && [4,5,6,7].includes(thirdCard)) ||
            (bankerTotal === 6 && [6,7].includes(thirdCard))) {
          bankerHand.push(this.drawCard());
          bankerTotal = this.calculateTotal(bankerHand);
        }
      } else if (bankerTotal <= 5) {
        bankerHand.push(this.drawCard());
        bankerTotal = this.calculateTotal(bankerHand);
      }
    }

    // Determine winner
    let result;
    if (playerTotal === bankerTotal) result = 'tie';
    else if (playerTotal > bankerTotal) result = 'player';
    else result = 'banker';

    // Calculate winnings
    let winnings = 0;
    if (position === result) {
      if (position === 'player') winnings = bet * 2;
      else if (position === 'banker') winnings = bet * 1.95;
      else if (position === 'tie') winnings = bet * 9;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        wallet: { increment: winnings - bet },
        totalWon: { increment: winnings > bet ? winnings - bet : 0 },
        totalLost: { increment: winnings > bet ? 0 : bet }
      }
    });

    return interaction.reply(`
🎴 Baccarat Result 🎴
Player's Hand: ${playerHand.join(', ')} (Total: ${playerTotal})
Banker's Hand: ${bankerHand.join(', ')} (Total: ${bankerTotal})
Winner: ${result.toUpperCase()}
Your bet: ${bet} on ${position}
${winnings > 0 ? `You won $${winnings}!` : 'You lost!'}
    `);
  }
} 