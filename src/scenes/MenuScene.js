(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  R.MenuScene = class MenuScene extends Phaser.Scene {
    constructor() {
      super('MenuScene');
    }

    create() {
      const { WIDTH: W, HEIGHT: H } = R.CONFIG;
      this.input.setDefaultCursor('default');
      R.platform.loadingReady(); // the portal may now hide its own loading screen
      this.cameras.main.setBackgroundColor(R.CONFIG.NIGHT_COLOR);

      this.add.image(W / 2, 140, 'glow').setScale(1.6).setBlendMode(Phaser.BlendModes.ADD);
      this.add.image(W / 2, 140, 'fire').setScale(1.5);
      this.add.image(W / 2 - 150, 150, 'player').setScale(1.6);
      this.add.image(W / 2 + 130, 150, 'walker').setScale(1.4).setFlipX(true);
      this.add.image(W / 2 + 210, 160, 'runner').setScale(1.4).setFlipX(true);
      this.add.image(W / 2 + 320, 145, 'brute').setScale(1.1).setFlipX(true);
      this.add
        .text(W / 2, 250, R.t('РАССВЕТ', 'DAWN'), { fontFamily: 'sans-serif', fontSize: '72px', fontStyle: 'bold', color: '#ffd9a0' })
        .setOrigin(0.5);
      this.add
        .text(W / 2, 318, R.t('Продержись до рассвета', 'Survive until dawn'), { fontFamily: 'sans-serif', fontSize: '28px', color: '#c9d4e8' })
        .setOrigin(0.5);

      const rules = [
        R.t('WASD — идти, мышь — целиться и стрелять, Shift — рывок, Q — огненное кольцо, E — капсула', 'WASD — move, mouse — aim and shoot, Shift — dash, Q — fire ring, E — capsule'),
        R.t('С 5 уровня открывается авто-огонь (Пробел — вкл/выкл)', 'Auto-fire unlocks at level 5 (Space — on/off)'),
        R.t('Ломай ящики: лечение, опыт, магнит, оружие или капсула защиты', 'Break crates: healing, experience, magnet, a weapon or a protective capsule'),
        R.t('Дрон-помощник стреляет сам. Монстры роняют кристаллы: собирай их и выбирай улучшения', 'Your drone shoots by itself. Monsters drop crystals: collect them and pick upgrades'),
        R.t('У костра здоровье восстанавливается. На рассвете солнце сожжёт всех тварей', 'Health regenerates by the campfire. At dawn the sun burns every monster'),
      ];
      this.add
        .text(W / 2, 438, rules.join('\n'), {
          fontFamily: 'sans-serif',
          fontSize: '19px',
          color: '#9fb0cc',
          align: 'center',
          lineSpacing: 8,
        })
        .setOrigin(0.5);

      const best = R.loadBest();
      this.add
        .text(W / 2, 533, R.t('Лучшее время: ', 'Best time: ') + (best > 0 ? R.formatTime(best) : '—') + R.t('     Рекорд алмазов: ', '     Diamonds record: ') + R.loadBestDiamonds(), {
          fontFamily: 'sans-serif',
          fontSize: '22px',
          color: '#ffd9a0',
        })
        .setOrigin(0.5);

      const btn = this.add
        .text(W / 2, 595, R.t('ИГРАТЬ', 'PLAY'), {
          fontFamily: 'sans-serif',
          fontSize: '40px',
          fontStyle: 'bold',
          color: '#10151f',
          backgroundColor: '#ffb36b',
          padding: { x: 36, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#ffd29e' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#ffb36b' }));
      btn.on('pointerup', () => this.start());
      this.input.keyboard.once('keydown-ENTER', () => this.start());

      const bank = R.loadShop().bank;
      const shopBtn = this.add
        .text(W / 2, 665, R.t('МАГАЗИН  (алмазов: ', 'SHOP  (diamonds: ') + bank + ')', {
          fontFamily: 'sans-serif',
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#10151f',
          backgroundColor: '#9be4ff',
          padding: { x: 28, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      shopBtn.on('pointerover', () => shopBtn.setStyle({ backgroundColor: '#c8f1ff' }));
      shopBtn.on('pointerout', () => shopBtn.setStyle({ backgroundColor: '#9be4ff' }));
      shopBtn.on('pointerup', () => this.scene.start('ShopScene'));

      this.add
        .text(W - 12, H - 10, 'v' + R.VERSION, { fontFamily: 'sans-serif', fontSize: '14px', color: '#5f6b82' })
        .setOrigin(1, 1);

      if (R.DEBUG) {
        this.add.text(12, H - 28, R.t('DEBUG: ночь ', 'DEBUG: night ') + R.CONFIG.NIGHT_SECONDS + R.t(' с', ' s'), {
          fontFamily: 'sans-serif',
          fontSize: '16px',
          color: '#ff8080',
        });
      }
    }

    start() {
      this.scene.start('GameScene');
    }
  };
})();
