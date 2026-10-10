(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  const FONT = 'sans-serif';
  const HP_BAR_W = 236;
  const XP_BAR_W = 360;
  const MAP_R = R.CONFIG.MAP_R;
  const MAP_RANGE = R.CONFIG.MAP_RANGE;

  R.UIScene = class UIScene extends Phaser.Scene {
    constructor() {
      super('UIScene');
    }

    create() {
      const { WIDTH: W, HEIGHT: H } = R.CONFIG;
      this.gameScene = this.scene.get('GameScene');
      this.menu = null; // level-up menu container
      this.pauseMenu = null; // pause menu container
      this.choices = [];
      this.menuOpenedAt = 0;

      this.buildHud(W, H);
      this.buildPauseButton(W);
      this.buildMinimap(W, H);

      // the portal asks for a pause (an ad, another tab): pause with our own menu, and
      // close it again when the portal says the game may go on
      this.pausedByPlatform = false;
      R.platform.onPause = () => {
        if (this.pauseMenu || this.menu) return;
        this.pausedByPlatform = true;
        this.pauseGame();
      };
      R.platform.onResume = () => {
        if (!this.pausedByPlatform) return;
        this.pausedByPlatform = false;
        if (this.pauseMenu) this.resumeGame();
      };
      this.events.once('shutdown', () => {
        R.platform.onPause = null;
        R.platform.onResume = null;
      });

      // game -> HUD events
      const ge = this.gameScene.events;
      const handlers = {
        hp: (hp, max) => this.setHp(hp, max),
        xp: (xp, need, level) => this.setXp(xp, need, level),
        kills: (n) => this.setKills(n),
        autofire: (on, unlocked) => this.setAutoFire(on, unlocked),
        diamonds: (n) => this.setDiamonds(n),
        boss: (hp, max, name) => this.setBoss(hp, max, name),
        banner: (text, color) => this.showBanner(text, color),
        time: (left) => this.timeText.setText(R.t('До рассвета  ', 'Until dawn  ') + R.formatTime(left)),
        levelup: (choices, levels) => this.showMenu(choices, levels),
      };
      for (const name of Object.keys(handlers)) ge.on(name, handlers[name]);
      this.events.once('shutdown', () => {
        for (const name of Object.keys(handlers)) ge.off(name, handlers[name]);
      });

      // events fired before this scene existed are lost: read initial state
      const gs = this.gameScene;
      this.setHp(gs.player.stats.hp, gs.player.stats.maxHp);
      this.setXp(gs.xp, R.xpForLevel(gs.level), gs.level);
      this.setKills(gs.kills);
      this.setAutoFire(gs.autoFire, gs.autoFireUnlocked);
      this.setDiamonds(gs.diamondCount);
      this.timeText.setText(R.t('До рассвета  ', 'Until dawn  ') + R.formatTime(R.CONFIG.NIGHT_SECONDS));

      this.input.keyboard.on('keydown-ONE', () => this.pick(0));
      this.input.keyboard.on('keydown-TWO', () => this.pick(1));
      this.input.keyboard.on('keydown-THREE', () => this.pick(2));
      this.input.keyboard.on('keydown-ESC', () => this.togglePause());
      this.input.keyboard.on('keydown-P', () => this.togglePause());
      this.input.keyboard.on('keydown-SPACE', () => this.gameScene.setAutoFire(!this.gameScene.autoFire));
    }

    // ---- HUD ------------------------------------------------------------

    buildHud(W, H) {
      // HP
      this.add.rectangle(20, 20, HP_BAR_W + 4, 22, 0x000000, 0.55).setOrigin(0);
      this.hpFill = this.add.rectangle(22, 22, HP_BAR_W, 18, 0xd33a3a).setOrigin(0);
      this.hpText = this.add.text(30, 21, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff' });

      // kills
      this.killsText = this.add.text(20, 52, '', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffd9a0',
        stroke: '#000000',
        strokeThickness: 3,
      });

      // diamonds
      this.diamondsText = this.add.text(20, 80, '', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#9be4ff',
        stroke: '#000000',
        strokeThickness: 3,
      });

      // boss health bar (under the timer, hidden until a boss is alive)
      const bx = W / 2 - 200;
      this.bossUi = [
        this.add.rectangle(bx, 108, 400, 20, 0x000000, 0.65).setOrigin(0).setStrokeStyle(2, 0xff6a5a),
        (this.bossFill = this.add.rectangle(bx + 2, 110, 396, 16, 0xd33a3a).setOrigin(0)),
        (this.bossLabel = this.add
          .text(W / 2, 118, R.t('БОСС', 'BOSS'), { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff' })
          .setOrigin(0.5)),
      ];
      this.bossUi.forEach((o) => o.setVisible(false));

      // centre banner (boss arrives, horde grows, ...)
      this.banner = this.add
        .text(W / 2, 175, '', {
          fontFamily: FONT,
          fontSize: '38px',
          fontStyle: 'bold',
          align: 'center',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(20);

      // time to dawn
      this.timeText = this.add
        .text(W / 2, 14, '', {
          fontFamily: FONT,
          fontSize: '32px',
          fontStyle: 'bold',
          color: '#ffd9a0',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0);

      // level + experience: label and a plain gray line with a blue fill, under the timer,
      // with a flag at the end of the line
      const barX = W / 2 - XP_BAR_W / 2;
      const barY = 84;
      this.levelText = this.add
        .text(W / 2, 58, '', {
          fontFamily: FONT,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0);
      this.add.rectangle(barX, barY, XP_BAR_W, 8, 0x555b66).setOrigin(0);
      this.xpFill = this.add.rectangle(barX, barY, 0, 8, 0x3aa0ff).setOrigin(0);
      const flagX = barX + XP_BAR_W + 8;
      this.add.rectangle(flagX, barY - 14, 3, 30, 0xd9d9d9).setOrigin(0); // pole
      this.add.triangle(flagX + 3, barY - 14, 0, 0, 20, 7, 0, 14, 0xe84a3a).setOrigin(0); // pennant

      // dash cooldown
      this.dashText = this.add.text(20, 142, '', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      });
      this.add.rectangle(20, 170, 150, 6, 0x333a46).setOrigin(0);
      this.dashBar = this.add.rectangle(20, 170, 0, 6, 0x6fd3ff).setOrigin(0);

      // current weapon (crates give timed weapons) and the protective capsule
      const small = { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 };
      this.weaponText = this.add.text(20, 190, '', small);
      this.add.rectangle(20, 218, 150, 6, 0x333a46).setOrigin(0);
      this.weaponBar = this.add.rectangle(20, 218, 0, 6, 0xffd24a).setOrigin(0);
      this.capsuleText = this.add.text(20, 232, '', small);
      this.add.rectangle(20, 260, 150, 6, 0x333a46).setOrigin(0);
      this.capsuleBar = this.add.rectangle(20, 260, 0, 6, 0x6fe8ff).setOrigin(0);
      this.novaText = this.add.text(20, 282, '', small);
      this.add.rectangle(20, 310, 150, 6, 0x333a46).setOrigin(0);
      this.novaBar = this.add.rectangle(20, 310, 0, 6, 0xff8a2a).setOrigin(0);

      // running night event, under the boss bar
      this.eventText = this.add
        .text(W / 2, 134, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5, 0)
        .setVisible(false);

      // auto-fire switch
      this.autoText = this.add
        .text(20, 112, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
        .setInteractive({ useHandCursor: true });
      this.autoText.on('pointerdown', () => this.gameScene.setAutoFire(!this.gameScene.autoFire));

      if (R.DEBUG) {
        this.add.text(W - 12, 82, 'DEBUG', { fontFamily: FONT, fontSize: '16px', color: '#ff8080' }).setOrigin(1, 0);
      }
    }

    buildPauseButton(W) {
      const x = W - 46;
      const y = 40;
      const btn = this.add
        .rectangle(x, y, 44, 44, 0x000000, 0.6)
        .setStrokeStyle(2, 0xffd9a0)
        .setInteractive({ useHandCursor: true });
      this.add.rectangle(x - 7, y, 7, 20, 0xffd9a0);
      this.add.rectangle(x + 7, y, 7, 20, 0xffd9a0);
      this.add
        .text(x, y + 32, 'Esc', { fontFamily: FONT, fontSize: '13px', color: '#c9d4e8' })
        .setOrigin(0.5);
      btn.on('pointerover', () => btn.setFillStyle(0x2a3857, 0.9));
      btn.on('pointerout', () => btn.setFillStyle(0x000000, 0.6));
      btn.on('pointerdown', () => this.togglePause());
    }

    // ---- minimap (round radar, north up, centred on the player) --------------

    buildMinimap(W, H) {
      const cx = W - 24 - MAP_R;
      const cy = H - 24 - MAP_R;
      this.mapC = { cx, cy };

      this.add.image(cx, cy, 'mapbezel').setDepth(4);
      this.add.image(cx, cy, 'mapbg').setDepth(4.5);

      // hatching shows through wherever the world floor is not drawn (beyond the world edge)
      this.mapHatch = this.add.tileSprite(cx, cy, MAP_R * 2, MAP_R * 2, 'maphatch').setDepth(4.6);
      this.mapGfx = this.add.graphics().setDepth(5);
      const shape = this.make.graphics({ x: 0, y: 0, add: false });
      shape.fillStyle(0xffffff).fillCircle(cx, cy, MAP_R - 1);
      const mask = shape.createGeometryMask(); // everything drawn is clipped to the circle
      this.mapGfx.setMask(mask);
      this.mapHatch.setMask(mask);

      const sweep = this.add.image(cx, cy, 'mapsweep').setDepth(5.2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: sweep, angle: 360, duration: 3600, repeat: -1 });
      this.add.image(cx, cy, 'maprim').setDepth(5.5);

      const letters = [['N', 0, '#ff7a6a'], ['E', 90, '#ffd9a0'], ['S', 180, '#ffd9a0'], ['W', 270, '#ffd9a0']];
      for (const [t, deg, color] of letters) {
        const a = ((deg - 90) * Math.PI) / 180;
        this.add
          .text(cx + Math.cos(a) * (MAP_R - 11), cy + Math.sin(a) * (MAP_R - 11), t, {
            fontFamily: FONT,
            fontSize: '12px',
            fontStyle: 'bold',
            color,
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(6);
      }
    }

    update() {
      this.drawMinimap();
      this.updateDash();
      this.updateStatus();
    }

    // weapon timer, capsule state, night event
    updateStatus() {
      const gs = this.gameScene;
      const p = gs && gs.player;
      if (!p || !p.scene || !gs.capsule) return;
      const nowMs = gs.elapsed * 1000;

      const w = gs.weapon;
      if (w.id === 'pistol') {
        this.weaponText.setText(R.t('Оружие: ', 'Weapon: ') + R.tt(w.name)).setColor('#9aa3b2');
        this.weaponBar.width = 0;
      } else {
        const left = Math.max(0, gs.weaponUntil - nowMs);
        this.weaponText.setText(R.t('Оружие: ', 'Weapon: ') + R.tt(w.name) + '  ' + Math.ceil(left / 1000) + R.t(' с', ' s')).setColor('#ffd24a');
        this.weaponBar.width = 150 * (left / R.WEAPON_DURATION_MS);
      }

      const nova = R.dashStatus(nowMs, gs.novaStart, R.CONFIG.ability.duration, R.CONFIG.ability.cooldown);
      if (nova.ready) this.novaText.setText(R.t('Огонь: готов  [Q]', 'Fire ring: ready  [Q]')).setColor('#ffb060');
      else this.novaText.setText(R.t('Огонь: ', 'Fire ring: ') + (nova.cooldownLeft / 1000).toFixed(1) + R.t(' с', ' s')).setColor('#9aa3b2');
      this.novaBar.width = 150 * nova.cooldownFrac;

      const cap = gs.capsule;
      if (cap.isActive(nowMs)) {
        const left = cap.leftMs(nowMs);
        this.capsuleText.setText(R.t('Капсула: ', 'Capsule: ') + (left / 1000).toFixed(1) + R.t(' с', ' s')).setColor('#6fe8ff');
        this.capsuleBar.width = 150 * (left / R.CONFIG.capsule.duration);
      } else if (cap.charges > 0) {
        this.capsuleText.setText(R.t('Капсула: готова  [E]', 'Capsule: ready  [E]')).setColor('#8fe88f');
        this.capsuleBar.width = 150;
      } else {
        this.capsuleText.setText(R.t('Капсула: нет', 'Capsule: none')).setColor('#7f8794');
        this.capsuleBar.width = 0;
      }

      const ev = gs.currentEvent;
      if (ev) {
        const left = ev.endsAt * R.CONFIG.NIGHT_SECONDS - gs.elapsed;
        this.eventText.setText(R.tt(ev.name).toUpperCase() + '  ' + R.formatTime(left)).setColor(ev.color).setVisible(true);
      } else {
        this.eventText.setVisible(false);
      }
    }

    updateDash() {
      const gs = this.gameScene;
      const p = gs && gs.player;
      if (!p || !p.scene) return;
      const st = p.dashStatus(gs.elapsed * 1000);
      if (st.ready) this.dashText.setText(R.t('Рывок: готов  [Shift]', 'Dash: ready  [Shift]')).setColor('#8fe88f');
      else this.dashText.setText(R.t('Рывок: ', 'Dash: ') + (st.cooldownLeft / 1000).toFixed(1) + R.t(' с', ' s')).setColor('#9aa3b2');
      this.dashBar.width = 150 * st.cooldownFrac;
    }

    drawMinimap() {
      const gs = this.gameScene;
      const p = gs && gs.player;
      if (!p || !p.scene || !gs.enemies || !gs.enemies.scene) return; // game scene is shutting down
      const C = R.CONFIG;
      const { cx, cy } = this.mapC;
      const k = MAP_R / MAP_RANGE;
      const g = this.mapGfx;
      const sx = (x) => cx + (x - p.x) * k;
      const sy = (y) => cy + (y - p.y) * k;
      const inside = (mx, my, pad) => (mx - cx) * (mx - cx) + (my - cy) * (my - cy) <= (MAP_R + pad) * (MAP_R + pad);
      // a marker for something off the map: sits on the rim, pointing outwards
      const rimArrow = (x, y, color) => {
        const a = Math.atan2(y - p.y, x - p.x);
        const tipX = cx + Math.cos(a) * (MAP_R - 3);
        const tipY = cy + Math.sin(a) * (MAP_R - 3);
        const bx = cx + Math.cos(a) * (MAP_R - 14);
        const by = cy + Math.sin(a) * (MAP_R - 14);
        const nx = -Math.sin(a) * 5.5;
        const ny = Math.cos(a) * 5.5;
        g.fillStyle(color, 0.35).fillCircle(bx, by, 9);
        g.fillStyle(color, 1).fillTriangle(tipX, tipY, bx + nx, by + ny, bx - nx, by - ny);
        g.lineStyle(1, 0xffffff, 0.8).strokeTriangle(tipX, tipY, bx + nx, by + ny, bx - nx, by - ny);
      };
      // soft round dot: halo + body
      const dot = (mx, my, r, color) => {
        g.fillStyle(color, 0.28).fillCircle(mx, my, r + 2.2);
        g.fillStyle(color, 1).fillCircle(mx, my, r);
      };

      g.clear();
      this.mapHatch.tilePositionX = p.x * k; // the hatching slides with the world
      this.mapHatch.tilePositionY = p.y * k;

      // the world floor (opaque, so the hatching only shows beyond its edge) + a bright border
      const wx = sx(0);
      const wy = sy(0);
      g.fillStyle(0x1f4d36, 1).fillRect(wx, wy, C.WORLD_W * k, C.WORLD_H * k);
      g.lineStyle(2.5, 0xa8f0b4, 0.95).strokeRect(wx, wy, C.WORLD_W * k, C.WORLD_H * k);

      // campfire glow (arrow on the rim when far away)
      const fx = sx(gs.centerX);
      const fy = sy(gs.centerY);
      g.fillStyle(0xff9a3a, 0.16).fillCircle(fx, fy, C.FIRE_RADIUS * k);
      g.lineStyle(1, 0xffb060, 0.5).strokeCircle(fx, fy, C.FIRE_RADIUS * k);
      dot(fx, fy, 3, 0xffc040);
      if (!inside(fx, fy, -8)) rimArrow(gs.centerX, gs.centerY, 0xffa030);

      for (const c of gs.crates.getChildren()) { // crates
        if (!c.active) continue;
        const mx = sx(c.x);
        const my = sy(c.y);
        if (!inside(mx, my, 3)) continue;
        g.fillStyle(0x3a2410, 1).fillRect(mx - 3, my - 3, 6, 6);
        g.fillStyle(0xd9a868, 1).fillRect(mx - 2, my - 2, 4, 4);
      }
      for (const c of gs.crystals.getChildren()) { // crystals
        if (!c.active) continue;
        const mx = sx(c.x);
        const my = sy(c.y);
        if (inside(mx, my, 2)) g.fillStyle(0x6fe8ff, 1).fillRect(mx - 1, my - 1, 2, 2);
      }
      for (const d of gs.diamonds.getChildren()) { // diamonds: bright with a halo
        const mx = sx(d.x);
        const my = sy(d.y);
        if (inside(mx, my, 3)) dot(mx, my, 2.2, 0xe8fbff);
      }

      const colors = { walker: 0xff5a4a, runner: 0xff7a3a, brute: 0xffa23a, golem: 0xcfd8e6, spitter: 0xb6e04a, exploder: 0xffe03a, healer: 0x5affc0, ghost: 0xb8a8ff };
      const bosses = [];
      for (const e of gs.enemies.getChildren()) {
        if (!e.active) continue;
        if (e.def.boss) {
          bosses.push(e);
          continue;
        }
        const mx = sx(e.x);
        const my = sy(e.y);
        if (!inside(mx, my, 3)) continue;
        dot(mx, my, e.def.radius > 20 ? 3.3 : 2, colors[e.type] || 0xff5a4a);
      }

      for (const d of gs.drones || []) { // your drones
        const mx = sx(d.x);
        const my = sy(d.y);
        if (inside(mx, my, 3)) dot(mx, my, 1.8, 0x7dffa0);
      }

      const pulse = 1 + 0.22 * Math.sin(this.time.now / 140);
      for (const b of bosses) {
        const mx = sx(b.x);
        const my = sy(b.y);
        if (inside(mx, my, -8)) {
          g.lineStyle(1.5, 0xff4dd2, 0.7).strokeCircle(mx, my, 8 * pulse);
          dot(mx, my, 4.2, 0xff4dd2);
          g.lineStyle(1, 0xffffff, 0.9).strokeCircle(mx, my, 4.2);
        } else {
          rimArrow(b.x, b.y, 0xff4dd2);
        }
      }

      // player: view cone + arrow pointing where the gun points
      const a = p.rotation;
      g.fillStyle(0x6fd3ff, 0.16);
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, 36, a - 0.4, a + 0.4);
      g.closePath();
      g.fillPath();
      const tip = [cx + Math.cos(a) * 8, cy + Math.sin(a) * 8];
      const left = [cx + Math.cos(a + 2.45) * 6, cy + Math.sin(a + 2.45) * 6];
      const right = [cx + Math.cos(a - 2.45) * 6, cy + Math.sin(a - 2.45) * 6];
      const back = [cx - Math.cos(a) * 2.5, cy - Math.sin(a) * 2.5];
      g.fillStyle(0x6fd3ff, 0.3).fillCircle(cx, cy, 9);
      g.fillStyle(0x4aa8e0, 1).fillPoints(
        [
          { x: tip[0], y: tip[1] },
          { x: left[0], y: left[1] },
          { x: back[0], y: back[1] },
          { x: right[0], y: right[1] },
        ],
        true
      );
      g.lineStyle(1.2, 0xffffff, 1).strokePoints(
        [
          { x: tip[0], y: tip[1] },
          { x: left[0], y: left[1] },
          { x: back[0], y: back[1] },
          { x: right[0], y: right[1] },
        ],
        true
      );
    }

    setHp(hp, max) {
      this.hpFill.width = Math.max(0, HP_BAR_W * (hp / max));
      this.hpText.setText('HP ' + Math.ceil(hp) + ' / ' + max);
    }

    setXp(xp, need, level) {
      this.xpFill.width = XP_BAR_W * Math.min(1, xp / need);
      this.levelText.setText(R.t('Уровень ', 'Level ') + level);
    }

    setDiamonds(n) {
      this.diamondsText.setText(R.t('Алмазы: ', 'Diamonds: ') + n);
    }

    setBoss(hp, max, name) {
      const show = max > 0;
      this.bossUi.forEach((o) => o.setVisible(show));
      if (show) {
        this.bossFill.width = 396 * Math.max(0, Math.min(1, hp / max));
        this.bossLabel.setText(name || R.t('БОСС', 'BOSS'));
      }
    }

    showBanner(text, color) {
      this.tweens.killTweensOf(this.banner);
      this.banner.setText(text).setColor(color).setAlpha(1);
      this.tweens.add({ targets: this.banner, alpha: 0, delay: 1400, duration: 800 });
    }

    setAutoFire(on, unlocked) {
      if (!unlocked) {
        this.autoText.setText(R.t('Авто-огонь: откроется на ' + R.AUTOFIRE_LEVEL + ' уровне', 'Auto-fire: unlocks at level ' + R.AUTOFIRE_LEVEL));
        this.autoText.setColor('#7f8794');
        return;
      }
      this.autoText.setText(R.t('Авто-огонь: ', 'Auto-fire: ') + (on ? R.t('ВКЛ', 'ON') : R.t('ВЫКЛ', 'OFF')) + R.t('  [Пробел]', '  [Space]'));
      this.autoText.setColor(on ? '#8fe88f' : '#9aa3b2');
    }

    setKills(n) {
      this.killsText.setText(R.t('Убито монстров: ', 'Monsters killed: ') + n);
    }

    // ---- pause ----------------------------------------------------------

    togglePause() {
      if (this.menu) return; // the level-up menu owns the pause
      if (this.pauseMenu) this.resumeGame();
      else this.pauseGame();
    }

    pauseGame() {
      const { WIDTH: W, HEIGHT: H } = R.CONFIG;
      this.gameScene.scene.pause();
      R.platform.gameplayStop();
      this.input.setDefaultCursor('default');

      const c = this.add.container(0, 0).setDepth(90);
      this.pauseMenu = c;
      c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.68).setOrigin(0));
      c.add(
        this.add
          .text(W / 2, 200, R.t('Пауза', 'Paused'), { fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#ffd9a0' })
          .setOrigin(0.5)
      );
      c.add(this.makeButton(W / 2, 340, R.t('ПРОДОЛЖИТЬ', 'RESUME'), () => this.resumeGame()));
      c.add(this.makeButton(W / 2, 430, R.t('В МЕНЮ', 'MAIN MENU'), () => this.toMenu()));
      c.add(
        this.add
          .text(W / 2, 520, R.t('Esc или P — продолжить', 'Esc or P — resume'), { fontFamily: FONT, fontSize: '20px', color: '#9fb0cc' })
          .setOrigin(0.5)
      );
    }

    resumeGame() {
      if (!this.pauseMenu) return;
      this.pauseMenu.destroy();
      this.pauseMenu = null;
      this.pausedByPlatform = false;
      this.input.setDefaultCursor('crosshair');
      this.gameScene.scene.resume();
      R.platform.gameplayStart();
    }

    toMenu() {
      this.pauseMenu = null;
      this.input.setDefaultCursor('default');
      this.scene.stop('GameScene');
      this.scene.start('MenuScene'); // also shuts this scene down
    }

    makeButton(x, y, label, onClick) {
      const btn = this.add
        .text(x, y, label, {
          fontFamily: FONT,
          fontSize: '36px',
          fontStyle: 'bold',
          color: '#10151f',
          backgroundColor: '#ffb36b',
          padding: { x: 36, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#ffd29e' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#ffb36b' }));
      btn.on('pointerup', onClick);
      return btn;
    }

    // ---- level-up menu --------------------------------------------------

    showMenu(choices, levels) {
      const { WIDTH: W, HEIGHT: H } = R.CONFIG;
      this.input.setDefaultCursor('default');
      this.choices = choices;
      this.menuOpenedAt = Date.now();

      const menu = this.add.container(0, 0).setDepth(100);
      this.menu = menu;
      menu.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0));
      menu.add(
        this.add
          .text(W / 2, 120, R.t('Новый уровень!', 'Level up!'), { fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: '#ffd9a0' })
          .setOrigin(0.5)
      );
      menu.add(
        this.add
          .text(W / 2, 180, R.t('Выбери улучшение: клик или клавиша 1 / 2 / 3', 'Choose an upgrade: click or press 1 / 2 / 3'), {
            fontFamily: FONT,
            fontSize: '20px',
            color: '#c9d4e8',
          })
          .setOrigin(0.5)
      );

      const cardW = 280;
      const cardH = 260;
      const gap = 40;
      const total = choices.length * cardW + (choices.length - 1) * gap;
      const startX = (W - total) / 2;

      choices.forEach((u, i) => {
        const x = startX + i * (cardW + gap);
        const y = 240;
        const have = levels[u.id] || 0;
        const card = this.add
          .rectangle(x, y, cardW, cardH, 0x1b2438)
          .setOrigin(0)
          .setStrokeStyle(3, 0xffb36b)
          .setInteractive({ useHandCursor: true });
        card.on('pointerover', () => card.setFillStyle(0x2a3857));
        card.on('pointerout', () => card.setFillStyle(0x1b2438));
        card.on('pointerdown', () => this.pick(i));

        const cx = x + cardW / 2;
        menu.add([
          card,
          this.add.text(cx, y + 24, String(i + 1), { fontFamily: FONT, fontSize: '22px', color: '#7f8fb0' }).setOrigin(0.5),
          this.add
            .text(cx, y + 80, R.tt(u.name), { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffffff' })
            .setOrigin(0.5),
          this.add
            .text(cx, y + 140, R.tt(u.desc), {
              fontFamily: FONT,
              fontSize: '20px',
              color: '#c9d4e8',
              align: 'center',
              wordWrap: { width: cardW - 40 },
            })
            .setOrigin(0.5),
          this.add
            .text(cx, y + 220, R.t('Уровень ', 'Level ') + have + ' → ' + (have + 1) + ' / ' + u.max, {
              fontFamily: FONT,
              fontSize: '18px',
              color: '#ffb36b',
            })
            .setOrigin(0.5),
        ]);
      });
    }

    pick(i) {
      if (!this.menu) return;
      // ignore clicks / keys right after the menu opens (player may still be firing)
      if (Date.now() - this.menuOpenedAt < 400) return;
      const upgrade = this.choices[i];
      if (!upgrade) return;
      this.menu.destroy();
      this.menu = null;
      this.input.setDefaultCursor('crosshair');
      this.gameScene.events.emit('upgradePicked', upgrade.id);
    }
  };
})();
