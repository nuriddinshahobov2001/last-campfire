(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  const FONT = 'sans-serif';

  R.EndScene = class EndScene extends Phaser.Scene {
    constructor() {
      super('EndScene');
    }

    create(data) {
      const { WIDTH: W } = R.CONFIG;
      const won = !!data.won;
      this.input.setDefaultCursor('default');
      this.cameras.main.setBackgroundColor(won ? 0x3a2a1a : 0x0a0f1f);

      const diamonds = data.diamonds || 0;
      let bankLine = R.t('Копилка не пополняется в режиме DEBUG', 'The bank is not filled in DEBUG mode');
      if (!R.DEBUG) {
        R.saveBest(data.seconds);
        R.saveBestDiamonds(diamonds);
        const state = R.addToBank(diamonds); // diamonds are kept for the shop
        bankLine = R.t('В копилку: +' + diamonds + '   (всего ' + state.bank + ')', 'Added to the bank: +' + diamonds + '   (total ' + state.bank + ')');
      }
      const best = R.loadBest();
      const bestDiamonds = R.loadBestDiamonds();

      this.add
        .text(W / 2, 170, won ? R.t('Рассвет!', 'Dawn!') : R.t('Ночь победила', 'The night won'), {
          fontFamily: FONT,
          fontSize: '84px',
          fontStyle: 'bold',
          color: won ? '#ffd9a0' : '#d86a6a',
        })
        .setOrigin(0.5);
      this.add
        .text(W / 2, 260, won ? R.t('Ты пережил ночь. Солнце сожгло тварей.', 'You survived the night. The sun burned the monsters.') : R.t('Тебя сожрали до рассвета.', 'You were eaten before dawn.'), {
          fontFamily: FONT,
          fontSize: '26px',
          color: '#c9d4e8',
        })
        .setOrigin(0.5);

      const lines = [
        R.t('Время выживания: ', 'Survived: ') + R.formatTime(data.seconds),
        R.t('Убито монстров: ', 'Monsters killed: ') + data.kills,
        R.t('Алмазы: ', 'Diamonds: ') + diamonds + (R.DEBUG ? '' : R.t('   (рекорд: ', '   (record: ') + bestDiamonds + ')'),
        bankLine,
        R.DEBUG ? R.t('Лучшее время: не сохраняется в режиме DEBUG', 'Best time: not saved in DEBUG mode') : R.t('Лучшее время: ', 'Best time: ') + (best > 0 ? R.formatTime(best) : '—'),
      ];
      const linesText = this.add
        .text(W / 2, 392, lines.join('\n'), {
          fontFamily: FONT,
          fontSize: '28px',
          color: '#ffffff',
          align: 'center',
          lineSpacing: 12,
        })
        .setOrigin(0.5);

      // short delay so a held mouse button / key from the last fight does not skip this screen
      let armed = false;
      this.time.delayedCall(600, () => (armed = true));

      const btn = this.add
        .text(W / 2 - 170, 640, R.t('ЕЩЁ РАЗ', 'PLAY AGAIN'), {
          fontFamily: FONT,
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

      // a portal ad (if the platform has ads) sits between two runs, never during play
      let busy = false;
      const restart = () => {
        if (!armed || busy) return;
        busy = true;
        R.platform.showInterstitial(() => this.scene.start('GameScene'));
      };
      btn.on('pointerup', restart);
      this.input.keyboard.on('keydown-ENTER', restart);

      const shopBtn = this.add
        .text(W / 2 + 190, 640, R.t('МАГАЗИН', 'SHOP'), {
          fontFamily: FONT,
          fontSize: '40px',
          fontStyle: 'bold',
          color: '#10151f',
          backgroundColor: '#9be4ff',
          padding: { x: 36, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      shopBtn.on('pointerover', () => shopBtn.setStyle({ backgroundColor: '#c8f1ff' }));
      shopBtn.on('pointerout', () => shopBtn.setStyle({ backgroundColor: '#9be4ff' }));
      shopBtn.on('pointerup', () => {
        if (armed && !busy) this.scene.start('ShopScene');
      });

      // watching a video doubles the diamonds of this run (only where the platform has ads)
      if (R.platform.hasAds && diamonds > 0 && !R.DEBUG) {
        const bonus = this.add
          .text(W / 2, 560, R.t('УДВОИТЬ АЛМАЗЫ (видео)', 'DOUBLE THE DIAMONDS (video)'), {
            fontFamily: FONT,
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#10151f',
            backgroundColor: '#8fe88f',
            padding: { x: 28, y: 10 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        bonus.on('pointerover', () => bonus.setStyle({ backgroundColor: '#b6f5b6' }));
        bonus.on('pointerout', () => bonus.setStyle({ backgroundColor: '#8fe88f' }));
        bonus.on('pointerup', () => {
          if (!armed || busy) return;
          busy = true;
          R.platform.showRewarded(
            () => {
              const state = R.addToBank(diamonds); // the same amount once more
              lines[3] = R.t('В копилку: +' + diamonds * 2 + '   (всего ' + state.bank + ')', 'Added to the bank: +' + diamonds * 2 + '   (total ' + state.bank + ')');
              linesText.setText(lines.join('\n'));
              bonus.destroy();
            },
            () => {
              busy = false;
            }
          );
        });
      }
    }
  };
})();
