export class BlackjackGame {
  constructor() {
    this.deck = this.createDeck();
    this.playerHand = [];
    this.dealerHand = [];
  }

  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }

    return this.shuffle(deck);
  }

  shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  dealInitialCards() {
    this.playerHand = [this.deck.pop(), this.deck.pop()];
    this.dealerHand = [this.deck.pop(), this.deck.pop()];
  }

  hit(hand) {
    hand.push(this.deck.pop());
  }

  getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value);
  }

  getHandValue(hand) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
      if (card.value === 'A') {
        aces += 1;
      }
      value += this.getCardValue(card);
    }

    while (value > 21 && aces > 0) {
      value -= 10;
      aces -= 1;
    }

    return value;
  }

  formatCard(card) {
    return `${card.value}${card.suit}`;
  }

  formatHand(hand) {
    return hand.map(card => this.formatCard(card)).join(' ');
  }

  dealerPlay() {
    while (this.getHandValue(this.dealerHand) < 17) {
      this.hit(this.dealerHand);
    }
  }
} 