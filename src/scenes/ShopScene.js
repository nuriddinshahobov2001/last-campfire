(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  const FONT = 'sans-serif';
  const CARD_W = 360;
  const CARD_H = 190;
  const GAP = 30;

  // Permanent upgrades bought with diamonds. Items and prices live in systems/Shop.js.
  R.ShopScene = class ShopScene extends Phaser.Scene {
    constructor() {
      super('ShopScene');
    }

    create() {
      const { WIDTH: W, HEIGHT: H } = R.CONFIG;
      this.input.setDefaultCursor('default');
      this.cameras.main.setBackgroundColor(R.CONFIG.NIGHT_COLOR);
      this.state = R.loadShop();

      this.add.image(W / 2, 70, 'glow').setScale(3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
      this.add
        .text(W / 2, 46, R.t('МАГАЗИН', 'SHOP'), { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffd9a0' })
        .setOrigin(0.5);
      this.add
        .text(W / 2, 96, R.t('Алмазы с боссов дают улучшения навсегда', 'Boss diamonds buy permanent upgrades'), { fontFamily: FONT, fontSize: '20px', color: '#9fb0cc' })
        .setOrigin(0.5);

      this.add.image(W / 2 - 36, 140, 'diamond').setScale(1.2);
      this.bankText = this.add
        .text(W / 2 - 12, 140, '', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#9be4ff' })
        .setOrigin(0, 0.5);

      const cols = 3;
      const startX = (W - (cols * CARD_W + (cols - 1) * GAP)) / 2;
      this.cards = R.SHOP_ITEMS.map((item, i) => {
        const x = startX + (i % cols) * (CARD_W + GAP);
        const y = 180 + Math.floor(i / cols) * (CARD_H + GAP);
        return this.makeCard(item, x, y);
      });

      const back = this.add
        .text(W / 2, H - 56, R.t('НАЗАД', 'BACK'), {
          fontFamily: FONT,
          fontSize: '34px',
          fontStyle: 'bold',
          color: '#10151f',
          backgroundColor: '#ffb36b',
          padding: { x: 36, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      back.on('pointerover', () => back.setStyle({ backgroundColor: '#ffd29e' }));
      back.on('pointerout', () => back.setStyle({ backgroundColor: '#ffb36b' }));
      back.on('pointerup', () => this.scene.start('MenuScene'));
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));

      this.refresh();
    }

    makeCard(item, x, y) {
      const rect = this.add
        .rectangle(x, y, CARD_W, CARD_H, 0x1b2438)
        .setOrigin(0)
        .setStrokeStyle(3, 0xffb36b)
        .setInteractive({ useHandCursor: true });
      const cx = x + CARD_W / 2;
      const card = { item, rect, x, y };
      card.name = this.add
        .text(cx, y + 26, R.tt(item.name), { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5);
      card.desc = this.add
        .text(cx, y + 58, R.tt(item.desc), { fontFamily: FONT, fontSize: '16px', color: '#9fb0cc' })
        .setOrigin(0.5);
      card.now = this.add
        .text(cx, y + 84, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#8fe88f' })
        .setOrigin(0.5);

      // one pip per level
      const pipGap = 26;
      const pipsX = cx - ((item.max - 1) * pipGap) / 2;
      card.pips = [];
      for (let i = 0; i < item.max; i++) {
        card.pips.push(this.add.circle(pipsX + i * pipGap, y + 116, 8, 0x333a4a).setStrokeStyle(2, 0xffd9a0));
      }

      card.icon = this.add.image(cx - 34, y + 156, 'diamond').setScale(0.9);
      card.cost = this.add
        .text(cx - 14, y + 156, '', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#9be4ff' })
        .setOrigin(0, 0.5);

      rect.on('pointerover', () => card.canBuy && rect.setFillStyle(0x2a3857));
      rect.on('pointerout', () => rect.setFillStyle(0x1b2438));
      rect.on('pointerdown', () => this.buy(card));
      return card;
    }

    buy(card) {
      const result = R.buyUpgrade(this.state, card.item.id);
      if (!result.ok) {
        // not enough diamonds (or already maxed): shake the card, flash the price
        this.tweens.add({ targets: card.rect, x: card.x + 6, duration: 50, yoyo: true, repeat: 3, onComplete: () => (card.rect.x = card.x) });
        card.cost.setColor('#ff5a5a');
        this.time.delayedCall(250, () => this.refresh());
        return;
      }
      this.state = result.state;
      R.saveShop(this.state);
      this.refresh();
      const pop = this.add
        .text(card.x + CARD_W / 2, card.y + 30, R.t('Куплено!', 'Bought!'), {
          fontFamily: FONT,
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#8fe88f',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(10);
      this.tweens.add({ targets: pop, y: pop.y - 36, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
    }

    refresh() {
      this.bankText.setText(String(this.state.bank));
      for (const card of this.cards) {
        const item = card.item;
        const level = this.state.levels[item.id] || 0;
        const cost = R.shopCost(item, level);
        const maxed = cost === null;
        card.canBuy = !maxed && this.state.bank >= cost;

        card.now.setText(level > 0 ? R.t('Сейчас: ', 'Now: ') + item.now(level) : R.t('Сейчас: ничего', 'Now: nothing'));
        card.pips.forEach((pip, i) => pip.setFillStyle(i < level ? 0xffd9a0 : 0x333a4a));
        card.icon.setVisible(!maxed);
        if (maxed) {
          card.cost.setText(R.t('МАКСИМУМ', 'MAX')).setColor('#ffd9a0').setX(card.x + CARD_W / 2 - 52);
        } else {
          card.cost.setText(String(cost)).setColor(card.canBuy ? '#9be4ff' : '#ff8a8a').setX(card.x + CARD_W / 2 - 14);
        }
        card.rect.setStrokeStyle(3, maxed ? 0x8a7a5a : card.canBuy ? 0xffb36b : 0x4a5468);
        card.rect.setFillStyle(0x1b2438);
        card.name.setAlpha(maxed || card.canBuy ? 1 : 0.7);
      }
    }
  };
})();
