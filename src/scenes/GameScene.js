(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  R.GameScene = class GameScene extends Phaser.Scene {
    constructor() {
      super('GameScene');
    }

    create() {
      const C = R.CONFIG;
      this.centerX = C.WORLD_W / 2;
      this.centerY = C.WORLD_H / 2;

      // run state (this scene instance is reused between runs)
      this.elapsed = 0;
      this.kills = 0;
      this.level = 1;
      this.xp = 0;
      this.upgradeLevels = {};
      this.pendingLevels = 0;
      this.menuOpen = false;
      this.dawning = false;
      this.ended = false;
      this.autoFire = false; // unlocks at level R.AUTOFIRE_LEVEL
      this.autoFireUnlocked = false;
      this.levelNotes = [];
      this.enemySpeedMult = 1;
      this.diamondCount = 0;
      this.prevF = 0;
      this.magnetUntil = 0;
      this.crateTimer = 0;
      this.mouseMoved = false;
      this.lastGhost = -1e9;
      this.drones = [];
      this.novaStart = -1e9; // when the Q fire ring was last used
      this.weapon = R.WEAPONS.pistol; // crates give timed weapons
      this.weaponUntil = 0;
      this.eventId = null;
      this.currentEvent = null;
      this.eventXpMult = 1;
      this.spawner = new R.Spawner();

      this.input.setDefaultCursor('crosshair');
      this.physics.world.setBounds(0, 0, C.WORLD_W, C.WORLD_H);

      this.grass = this.add.tileSprite(0, 0, C.WORLD_W, C.WORLD_H, 'grass').setOrigin(0).setDepth(0);

      // campfire
      this.scatterDecor();
      this.add
        .circle(this.centerX, this.centerY, C.FIRE_RADIUS)
        .setStrokeStyle(2, 0xffc060, 0.3)
        .setDepth(1);
      this.fire = this.add.image(this.centerX, this.centerY, 'fire').setDepth(2);
      this.tweens.add({
        targets: this.fire,
        scaleX: { from: 1, to: 0.94 },
        scaleY: { from: 1, to: 1.12 },
        duration: 210,
        yoyo: true,
        repeat: -1,
      });

      this.player = new R.Player(this, this.centerX + 90, this.centerY);

      this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 300 });
      // +6: bosses always fit on top of the normal enemy cap
      this.enemies = this.physics.add.group({ classType: R.Enemy, maxSize: C.MAX_ENEMIES + 6 });
      this.crystals = this.add.group();
      this.diamonds = this.add.group();
      this.crates = this.physics.add.staticGroup();
      this.abilities = new R.EnemyAbilities(this);
      this.bossAbilities = new R.BossAbilities(this);
      this.capsule = new R.CapsuleShield(this);
      this.makeParticles();

      // darkness over the world + warm light around the fire
      this.shade = this.add
        .rectangle(0, 0, C.WIDTH, C.HEIGHT, C.NIGHT_COLOR, 0.45)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(50);
      this.add
        .image(this.centerX, this.centerY, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(51);
      this.add
        .image(C.WIDTH / 2, C.HEIGHT / 2, 'vignette')
        .setScrollFactor(0)
        .setDepth(52);
      this.eventFx = new R.EventFx(this);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, C.WORLD_W, C.WORLD_H);
      cam.startFollow(this.player, true, 0.12, 0.12);
      cam.setBackgroundColor(C.NIGHT_COLOR);

      this.keys = this.input.keyboard.addKeys('SHIFT,E,Q'); // one-shot keys; movement is R.held

      this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
      this.physics.add.overlap(this.player, this.enemies, this.onPlayerTouched, null, this);
      this.physics.add.collider(this.enemies, this.enemies);
      this.physics.add.collider(this.player, this.crates);
      this.physics.add.collider(this.enemies, this.crates);
      this.physics.add.overlap(this.bullets, this.crates, this.onBulletCrate, null, this);
      this.physics.add.overlap(this.player, this.abilities.spits, this.onSpitHitPlayer, null, this);
      this.physics.add.overlap(this.abilities.spits, this.crates, (spit) => spit.disableBody(true, true));
      for (let i = 0; i < C.crates.count; i++) this.spawnCrate(200);

      // until the mouse moves there is no aim point: face right
      this.input.on('pointermove', () => (this.mouseMoved = true));

      const onPicked = (id) => this.onUpgradePicked(id);
      this.events.on('upgradePicked', onPicked);
      this.events.once('shutdown', () => this.events.off('upgradePicked', onPicked));

      this.scene.launch('UIScene');
      R.platform.gameplayStart();
      this.events.emit('hp', this.player.stats.hp, this.player.stats.maxHp);
      this.events.emit('xp', this.xp, R.xpForLevel(this.level), this.level);
      this.events.emit('time', C.NIGHT_SECONDS);
    }

    update(time, delta) {
      if (this.ended) return;
      const C = R.CONFIG;
      const dt = Math.min(delta, 100) / 1000;
      this.elapsed += dt;
      const nowMs = this.elapsed * 1000;
      const f = Math.min(this.elapsed / C.NIGHT_SECONDS, 1);
      const pointer = this.input.activePointer;

      // night events: fog, rain, blood moon (more monsters, more experience)
      const ev = R.activeEvent(f);
      const evId = ev ? ev.id : null;
      if (evId !== this.eventId) {
        this.eventId = evId;
        this.eventFx.set(ev);
      }
      this.currentEvent = ev;
      this.eventXpMult = ev ? ev.xpMult : 1;
      this.eventFx.update(nowMs);

      // a picked-up weapon runs out and the player is back to the pistol
      if (this.weapon.id !== 'pistol' && nowMs >= this.weaponUntil) {
        this.weapon = R.WEAPONS.pistol;
        this.floatText(this.player.x, this.player.y - 40, R.tt(R.WEAPONS.pistol.name), '#c9d4e8');
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.capsule.activate(nowMs);
      if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.tryNova(nowMs);

      // The mouse always aims. Auto-fire shoots without stopping; with it off,
      // hold the mouse button to shoot.
      const aim = this.mouseMoved ? null : { x: this.player.x + 100, y: this.player.y };
      if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) this.tryDash(nowMs);
      this.player.update(pointer, this.cameras.main, aim, nowMs);
      this.syncDrones();
      for (const d of this.drones) d.update(nowMs, dt, this.drones.length);
      if (this.player.isDashing(nowMs)) this.dashGhost(nowMs);
      const volley = R.weaponVolley(this.weapon, this.player.stats);
      if (this.player.canFire(nowMs, this.autoFire || pointer.isDown, volley.interval)) this.fireVolley(nowMs, volley);

      if (f >= 1 && !this.dawning) this.startDawn();

      if (!this.dawning) {
        const alive = this.enemies.countActive(true);
        const horde = R.spawnMultiplier(this.level) * (ev ? ev.spawnMult : 1);
        for (const type of this.spawner.update(dt, f, alive, horde)) this.spawnEnemy(type, f);
        const bossTypes = R.bossTypesCrossed(this.prevF, f);
        if (bossTypes.length) this.spawnBossWave(bossTypes, f);
        this.enemySpeedMult = R.enemySpeedMultiplier(this.level) * (ev ? ev.speedMult : 1);
        for (const e of this.enemies.getChildren()) {
          if (!e.active) continue;
          if (nowMs < e.knockUntil) continue; // thrown back by the fire ring
          if (e.ai && e.ai.state !== 'idle') continue; // a boss busy with an attack moves itself
          e.chase(this.player);
        }
      }
      this.prevF = f;
      this.updateBurning(nowMs);
      this.bossAbilities.update(nowMs);
      this.capsule.update(nowMs); // after the chase: the dome overrides the velocity of pushed monsters
      this.abilities.update(nowMs);

      this.updateBullets(nowMs);
      this.updateCrystals(dt);
      this.updateDiamonds(dt);
      this.updateFire(dt);
      this.updateSky(f);
      this.updateCrates(dt);

      this.events.emit('time', Math.max(0, C.NIGHT_SECONDS - this.elapsed));
    }

    // ---- look & feel ----------------------------------------------------

    scatterDecor() {
      const C = R.CONFIG;
      for (let i = 0; i < 70; i++) {
        const x = Phaser.Math.Between(40, C.WORLD_W - 40);
        const y = Phaser.Math.Between(40, C.WORLD_H - 40);
        if (Phaser.Math.Distance.Between(x, y, this.centerX, this.centerY) < 220) continue;
        this.add
          .image(x, y, Math.random() < 0.45 ? 'rock' : 'bush')
          .setDepth(1)
          .setFlipX(Math.random() < 0.5)
          .setScale(Phaser.Math.FloatBetween(0.8, 1.3))
          .setAngle(Phaser.Math.Between(-10, 10));
      }
    }

    makeParticles() {
      this.sparks = this.add
        .particles(0, 0, 'spark', {
          lifespan: { min: 200, max: 420 },
          speed: { min: 60, max: 200 },
          scale: { start: 1.1, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xffe27a, 0xff9a3a],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(7);

      this.wood = this.add
        .particles(0, 0, 'spark', {
          lifespan: { min: 300, max: 700 },
          speed: { min: 50, max: 210 },
          scale: { start: 1.6, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xb88a58, 0x7a5230, 0xd9a868],
          emitting: false,
        })
        .setDepth(4);

      // the Q fire ring: sparks flying out in all directions
      this.flames = this.add
        .particles(0, 0, 'spark', {
          lifespan: { min: 450, max: 650 },
          speed: { min: 380, max: 520 },
          scale: { start: 2.2, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xff5a1a, 0xffa030, 0xffe27a],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(8);

      this.blood = {};
      for (const [type, color] of [['walker', 0x86e06a], ['runner', 0xff9a3a], ['brute', 0xc060e0], ['golem', 0xaab0b8], ['boss', 0xff3030], ['colossus', 0xc8ced8], ['wraith', 0x9a7aff], ['spitter', 0xb6e04a], ['exploder', 0xff5a2a], ['healer', 0x6aff8a], ['ghost', 0x9a7aff]]) {
        this.blood[type] = this.add
          .particles(0, 0, 'spark', {
            lifespan: { min: 300, max: 650 },
            speed: { min: 40, max: 190 },
            scale: { start: 1.8, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tint: color,
            emitting: false,
          })
          .setDepth(4);
      }

      this.add
        .particles(this.centerX, this.centerY - 8, 'spark', {
          lifespan: { min: 700, max: 1400 },
          speedX: { min: -22, max: 22 },
          speedY: { min: -80, max: -30 },
          scale: { start: 0.7, end: 0 },
          alpha: { start: 0.95, end: 0 },
          tint: [0xff8a2a, 0xffd24a],
          frequency: 90,
          blendMode: 'ADD',
        })
        .setDepth(51);
    }

    // ---- shooting -------------------------------------------------------

    // Shift: burst in the move direction (or where the gun points when standing still).
    tryDash(nowMs) {
      const p = this.player;
      if (!p.canDash(nowMs)) return;
      let { x: dx, y: dy } = R.held.move();
      if (dx === 0 && dy === 0) {
        dx = Math.cos(p.rotation);
        dy = Math.sin(p.rotation);
      }
      p.startDash(nowMs, dx, dy);
      this.sparks.explode(10, p.x, p.y);
    }

    // After-image trail while dashing.
    dashGhost(nowMs) {
      if (nowMs - this.lastGhost < 22) return;
      this.lastGhost = nowMs;
      const p = this.player;
      const ghost = this.add
        .image(p.x, p.y, 'player')
        .setOrigin(24 / 56, 0.5)
        .setRotation(p.rotation)
        .setTint(0x6fd3ff)
        .setAlpha(0.55)
        .setDepth(9);
      this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
    }

    setAutoFire(on) {
      if (!this.autoFireUnlocked) return;
      this.autoFire = on;
      this.events.emit('autofire', on, true);
    }

    // vol: R.weaponVolley() of the current weapon
    fireVolley(nowMs, vol) {
      for (const offset of vol.angles) this.fireBullet(this.player.rotation + offset, vol, nowMs);
    }

    fireBullet(angle, vol, nowMs) {
      const w = this.weapon;
      const tex = R.BULLET_TEX[w.tex];
      const x = this.player.x + Math.cos(angle) * 22;
      const y = this.player.y + Math.sin(angle) * 22;
      const b = this.bullets.get(x, y);
      if (!b) return;
      b.enableBody(true, x, y, true, true);
      b.setTexture(w.tex);
      b.clearTint(); // the pool is shared with the drones' green bolts
      b.setDepth(6);
      b.setRotation(angle);
      b.setCircle(tex.r, tex.w / 2 - tex.r, tex.h / 2 - tex.r);
      b.setBlendMode(w.blend === 'ADD' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      this.physics.velocityFromRotation(angle, vol.speed, b.body.velocity);
      b.damage = vol.damage;
      b.pierceLeft = vol.pierce;
      b.explosion = w.explosion || null;
      if (b.hitSet) b.hitSet.clear();
      else b.hitSet = new Set();
      b.expireAt = nowMs + vol.life;
    }

    // Q: a ring of fire around the player. Hurts everything near, throws normal monsters back,
    // sets them alight (damage over time) and burns enemy projectiles out of the air.
    tryNova(nowMs) {
      const A = R.CONFIG.ability;
      if (!R.dashStatus(nowMs, this.novaStart, A.duration, A.cooldown).ready) return;
      this.novaStart = nowMs;
      const p = this.player;
      const damage = p.stats.damage * A.damageMul;
      this.novaFx(p.x, p.y, A.radius);
      for (const e of this.enemies.getChildren()) {
        if (!e.active) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > A.radius + e.def.radius) continue;
        e.burning = true;
        e.burnUntil = nowMs + A.burnMs;
        e.nextBurn = nowMs + 500;
        if (!e.def.boss) {
          e.knockUntil = nowMs + 250;
          e.setVelocity((dx / d) * A.knock, (dy / d) * A.knock);
        }
        const dead = e.hit(damage);
        if (e.def.boss) this.emitBoss();
        if (dead) this.killEnemy(e);
      }
      for (const b of this.abilities.spits.getChildren()) {
        if (b.active && Math.hypot(b.x - p.x, b.y - p.y) <= A.radius) {
          this.sparks.explode(5, b.x, b.y);
          b.disableBody(true, true);
        }
      }
    }

    novaFx(x, y, radius) {
      this.flames.explode(70, x, y);
      const ring = this.add.circle(x, y, radius * 0.15).setStrokeStyle(10, 0xff7a1a, 0.95).setDepth(8);
      this.tweens.add({ targets: ring, scale: 6.6, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
      const glow = this.add.circle(x, y, radius, 0xff6a1a, 0.28).setDepth(7);
      this.tweens.add({ targets: glow, alpha: 0, scale: 1.15, duration: 450, onComplete: () => glow.destroy() });
      this.cameras.main.shake(200, 0.006);
      this.cameras.main.flash(160, 255, 150, 50);
    }

    // Burning monsters take a little damage twice a second.
    updateBurning(nowMs) {
      const A = R.CONFIG.ability;
      const tick = this.player.stats.damage * A.damageMul * A.burnFrac;
      for (const e of this.enemies.getChildren()) {
        if (!e.active || !e.burning) continue;
        if (nowMs >= e.burnUntil) {
          e.burning = false;
          e.clearTint();
          continue;
        }
        e.setTint(0xff9a4a);
        if (nowMs < e.nextBurn) continue;
        e.nextBurn = nowMs + 500;
        this.sparks.explode(2, e.x, e.y);
        const dead = e.hit(tick);
        if (e.def.boss) this.emitBoss();
        if (dead) this.killEnemy(e);
      }
    }

    // One drone per point of stats.drones (the level-up card adds more).
    syncDrones() {
      while (this.drones.length < this.player.stats.drones) {
        const d = new R.Drone(this, this.drones.length);
        this.drones.push(d);
        this.sparks.explode(10, d.x, d.y);
        if (this.elapsed > 1) this.floatText(d.x, d.y - 24, R.t('Дрон!', 'Drone!'), '#7dffa0');
      }
    }

    // A bolt from a drone: green, weaker than the player's own shots.
    fireDroneShot(x, y, angle, nowMs) {
      const D = R.CONFIG.drone;
      const b = this.bullets.get(x, y);
      if (!b) return;
      b.enableBody(true, x, y, true, true);
      b.setTexture('bullet');
      b.setTint(0x7dffa0);
      b.setDepth(6);
      b.setRotation(angle);
      b.setCircle(4, 4, 4);
      b.setBlendMode(Phaser.BlendModes.ADD);
      this.physics.velocityFromRotation(angle, D.speed, b.body.velocity);
      b.damage = this.player.stats.damage * D.damageMul;
      b.pierceLeft = 0;
      b.explosion = null;
      if (b.hitSet) b.hitSet.clear();
      else b.hitSet = new Set();
      b.expireAt = nowMs + D.life;
    }

    updateBullets(nowMs) {
      for (const b of this.bullets.getChildren()) {
        if (!b.active || nowMs < b.expireAt) continue;
        if (b.explosion) this.explodeRocket(b); // a rocket that flew too far still blows up
        this.killBullet(b);
      }
    }

    // A weapon from a crate: lasts R.WEAPON_DURATION_MS of game time.
    equipWeapon(id) {
      this.weapon = R.WEAPONS[id];
      this.weaponUntil = this.elapsed * 1000 + R.WEAPON_DURATION_MS;
      this.sparks.explode(12, this.player.x, this.player.y);
    }

    // Rocket blast: damages every monster and crate in the radius.
    explodeRocket(b) {
      const r = b.explosion.radius;
      this.blastFx(b.x, b.y, r, 0xffa03a);
      for (const e of this.enemies.getChildren()) {
        if (!e.active || Math.hypot(e.x - b.x, e.y - b.y) > r + e.def.radius) continue;
        const dead = e.hit(b.damage);
        if (e.def.boss) this.emitBoss();
        if (dead) this.killEnemy(e);
      }
      for (const c of this.crates.getChildren()) {
        if (!c.active || Math.hypot(c.x - b.x, c.y - b.y) > r + 22) continue;
        c.hp -= b.damage;
        if (c.hp <= 0) this.breakCrate(c);
      }
    }

    ringFx(x, y, radius, color) {
      const ring = this.add.circle(x, y, radius * 0.25).setStrokeStyle(4, color, 0.9).setDepth(8);
      this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    }

    blastFx(x, y, radius, color) {
      this.ringFx(x, y, radius, color);
      this.sparks.explode(18, x, y);
      const flash = this.add.circle(x, y, radius * 0.6, color, 0.35).setDepth(8);
      this.tweens.add({ targets: flash, alpha: 0, scale: 1.4, duration: 260, onComplete: () => flash.destroy() });
      this.cameras.main.shake(120, 0.004);
    }

    killBullet(b) {
      b.disableBody(true, true);
    }

    onBulletHit(bullet, enemy) {
      if (!bullet.active || !enemy.active || bullet.hitSet.has(enemy)) return;
      if (bullet.explosion) {
        this.explodeRocket(bullet);
        this.killBullet(bullet);
        return;
      }
      bullet.hitSet.add(enemy);
      this.sparks.explode(3, bullet.x, bullet.y);
      const dead = enemy.hit(bullet.damage);
      if (enemy.def.boss) this.emitBoss();
      if (dead) this.killEnemy(enemy);
      if (bullet.pierceLeft <= 0) this.killBullet(bullet);
      else bullet.pierceLeft--;
    }

    // ---- enemies --------------------------------------------------------

    spawnEnemy(type, f) {
      const C = R.CONFIG;
      let x;
      let y;
      let ok = false;
      for (let i = 0; i < 8 && !ok; i++) {
        const a = Math.random() * Math.PI * 2;
        x = this.player.x + Math.cos(a) * C.SPAWN_DISTANCE;
        y = this.player.y + Math.sin(a) * C.SPAWN_DISTANCE;
        ok = x > 20 && x < C.WORLD_W - 20 && y > 20 && y < C.WORLD_H - 20;
      }
      x = Phaser.Math.Clamp(x, 20, C.WORLD_W - 20);
      y = Phaser.Math.Clamp(y, 20, C.WORLD_H - 20);

      const e = this.enemies.get(x, y, type);
      if (!e) return null;
      e.spawn(type, x, y, 1 + C.ENEMY_HP_GROWTH * f);
      return e;
    }

    spawnBossWave(types, f) {
      const names = [];
      for (const type of types) {
        const e = this.spawnEnemy(type, f);
        if (e) names.push(R.tt(e.def.name));
      }
      if (!names.length) return;
      this.emitBoss();
      this.events.emit('banner', R.t('БОСС: ', 'BOSS: ') + names.join(R.t(' и ', ' & ')), '#ff6a5a');
      this.cameras.main.shake(300, 0.006);
    }

    // HUD boss bar: total health of every living boss.
    emitBoss() {
      const bosses = this.enemies.getChildren().filter((e) => e.active && e.def.boss);
      if (!bosses.length) {
        this.events.emit('boss', 0, 0, '');
        return;
      }
      let hp = 0;
      let max = 0;
      for (const b of bosses) {
        hp += Math.max(0, b.hp);
        max += b.maxHp;
      }
      const name = bosses.length === 1 ? R.tt(bosses[0].def.name) : R.t('БОССЫ ×', 'BOSSES ×') + bosses.length;
      this.events.emit('boss', hp, max, name);
    }

    killEnemy(enemy) {
      this.kills++;
      this.events.emit('kills', this.kills);
      const burst = { brute: 18, golem: 22, boss: 40, colossus: 60, wraith: 36, exploder: 14 }[enemy.type] || 10;
      this.blood[enemy.type].explode(burst, enemy.x, enemy.y);
      this.dropCrystal(enemy.x, enemy.y, enemy.def.xp * this.eventXpMult); // events: more experience
      if (enemy.def.explodes) this.abilities.blast(enemy.x, enemy.y, enemy.def.explodes);
      if (enemy.def.boss) this.onBossKilled(enemy);
      enemy.disableBody(true, true);
      if (enemy.def.boss) this.emitBoss();
    }

    onBossKilled(boss) {
      const C = R.CONFIG;
      const n = boss.def.diamonds;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const r = 40 + Math.random() * 14;
        const x = Phaser.Math.Clamp(boss.x + Math.cos(a) * r, 20, C.WORLD_W - 20);
        const y = Phaser.Math.Clamp(boss.y + Math.sin(a) * r, 20, C.WORLD_H - 20);
        const d = this.diamonds.create(x, y, 'diamond').setDepth(3);
        this.tweens.add({ targets: d, scale: { from: 1, to: 1.18 }, yoyo: true, repeat: -1, duration: 520 });
      }
      this.events.emit('banner', R.t('Босс повержен! +' + n + ' алмазов', 'Boss defeated! +' + n + ' diamonds'), '#9be4ff');
      this.cameras.main.shake(200, 0.004);
    }

    onPlayerTouched(player, enemy) {
      if (!enemy.active || this.dawning || this.ended) return;
      const nowMs = this.elapsed * 1000;
      if (this.isInvulnerable(nowMs)) return;
      if (enemy.def.explodes) {
        // an exploder that reaches the player blows up (no kill, no experience)
        this.abilities.blast(enemy.x, enemy.y, enemy.def.explodes);
        enemy.disableBody(true, true);
        return;
      }
      if (nowMs - enemy.lastHitAt < R.CONFIG.CONTACT_COOLDOWN) return;
      enemy.lastHitAt = nowMs;
      this.hurtPlayer(enemy.def.damage * enemy.dmgMul);
    }

    // Invulnerable while dashing or inside the protective capsule.
    isInvulnerable(nowMs) {
      return this.player.isDashing(nowMs) || this.capsule.isActive(nowMs);
    }

    // Damages the player unless invulnerable. Returns true when it hurt.
    hurtPlayer(amount) {
      if (this.ended || this.dawning) return false;
      if (this.isInvulnerable(this.elapsed * 1000)) return false;
      const p = this.player;
      p.takeDamage(amount);
      this.cameras.main.shake(90, 0.003);
      this.events.emit('hp', p.stats.hp, p.stats.maxHp);
      if (p.stats.hp <= 0) this.endGame(false);
      return true;
    }

    onSpitHitPlayer(player, spit) {
      if (!spit.active) return;
      this.sparks.explode(5, spit.x, spit.y);
      spit.disableBody(true, true);
      this.hurtPlayer(spit.damage);
    }

    // ---- crates ---------------------------------------------------------

    // playerAvoid: keep new crates at least this far from the player
    spawnCrate(playerAvoid) {
      const C = R.CONFIG;
      const avoid = [
        { x: this.centerX, y: this.centerY, r: 260 },
        { x: this.player.x, y: this.player.y, r: playerAvoid },
      ];
      const existing = this.crates.getChildren().filter((c) => c.active);
      const spot = R.pickCrateSpot(existing, avoid, Math.random);
      if (!spot) return;
      const c = this.crates.get(spot.x, spot.y, 'crate');
      if (!c) return;
      c.enableBody(true, spot.x, spot.y, true, true);
      c.setDepth(3);
      c.clearTint();
      c.hp = C.crates.hp;
    }

    updateCrates(dt) {
      this.crateTimer += dt;
      if (this.crateTimer < R.CONFIG.crates.respawnSec) return;
      this.crateTimer = 0;
      if (this.crates.countActive(true) < R.CONFIG.crates.count) this.spawnCrate(350);
    }

    onBulletCrate(bullet, crate) {
      if (!bullet.active || !crate.active || bullet.hitSet.has(crate)) return;
      if (bullet.explosion) {
        this.explodeRocket(bullet);
        this.killBullet(bullet);
        return;
      }
      bullet.hitSet.add(crate);
      this.sparks.explode(3, bullet.x, bullet.y);
      crate.hp -= bullet.damage;
      if (crate.hp <= 0) {
        this.breakCrate(crate);
      } else {
        crate.setTintFill(0xffffff);
        this.time.delayedCall(50, () => crate.active && crate.clearTint());
      }
      if (bullet.pierceLeft <= 0) this.killBullet(bullet);
      else bullet.pierceLeft--;
    }

    breakCrate(crate) {
      const C = R.CONFIG.crates;
      const x = crate.x;
      const y = crate.y;
      this.wood.explode(14, x, y);
      crate.disableBody(true, true);

      const loot = R.rollCrateLoot();
      if (loot === 'heal') {
        this.player.heal(C.healAmount);
        this.events.emit('hp', this.player.stats.hp, this.player.stats.maxHp);
        this.floatText(x, y - 14, '+' + C.healAmount + ' HP', '#7be07b');
      } else if (loot === 'xp') {
        for (let i = 0; i < C.xpCrystals; i++) {
          const a = (i / C.xpCrystals) * Math.PI * 2 + 0.5;
          this.dropCrystal(x + Math.cos(a) * 24, y + Math.sin(a) * 24, C.xpEach);
        }
        this.floatText(x, y - 14, R.t('Опыт!', 'XP!'), '#6fe8ff');
      } else if (loot === 'weapon') {
        const id = R.rollWeapon();
        this.equipWeapon(id);
        this.floatText(x, y - 14, R.tt(R.WEAPONS[id].name) + '!', '#ffd24a');
      } else if (loot === 'capsule') {
        this.capsule.grant(x, y);
      } else {
        this.magnetUntil = this.elapsed + C.magnetSec;
        this.floatText(x, y - 14, R.t('Магнит!', 'Magnet!'), '#ffe27a');
      }
    }

    floatText(x, y, text, color) {
      const t = this.add
        .text(x, y, text, {
          fontFamily: 'sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color,
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(8);
      this.tweens.add({ targets: t, y: y - 42, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }

    // ---- experience -----------------------------------------------------

    dropCrystal(x, y, xp) {
      const c = this.crystals.get(x, y, 'crystal');
      if (!c) return;
      c.setActive(true).setVisible(true).setPosition(x, y).setDepth(3);
      c.xp = xp;
    }

    updateCrystals(dt) {
      const p = this.player;
      const magnet = this.elapsed < this.magnetUntil;
      const range = magnet ? Infinity : p.stats.pickupRadius;
      const speed = R.CONFIG.CRYSTAL_SPEED * (magnet ? 1.8 : 1);
      for (const c of this.crystals.getChildren()) {
        if (!c.active) continue;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 18) {
          c.setActive(false).setVisible(false);
          this.gainXp(c.xp);
        } else if (dist <= range) {
          const step = Math.min(speed * dt, dist);
          c.x += (dx / dist) * step;
          c.y += (dy / dist) * step;
        }
      }
    }

    updateDiamonds(dt) {
      const p = this.player;
      const magnet = this.elapsed < this.magnetUntil;
      const range = magnet ? Infinity : p.stats.pickupRadius * 1.5;
      const speed = R.CONFIG.CRYSTAL_SPEED * (magnet ? 1.8 : 1);
      for (const d of this.diamonds.getChildren().slice()) {
        const dx = p.x - d.x;
        const dy = p.y - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 24) {
          this.sparks.explode(8, d.x, d.y);
          this.tweens.killTweensOf(d);
          d.destroy();
          this.diamondCount++;
          this.events.emit('diamonds', this.diamondCount);
        } else if (dist <= range) {
          const step = Math.min(speed * dt, dist);
          d.x += (dx / dist) * step;
          d.y += (dy / dist) * step;
        }
      }
    }

    gainXp(amount) {
      this.xp += amount;
      let need = R.xpForLevel(this.level);
      while (this.xp >= need) {
        this.xp -= need;
        this.level++;
        this.pendingLevels++;
        this.onLevelReached(this.level);
        need = R.xpForLevel(this.level);
      }
      this.events.emit('xp', this.xp, need, this.level);
      this.tryLevelUp();
    }

    // Level milestones: auto-fire at 5, +5% monster speed per 5 levels, bigger horde after 10.
    onLevelReached(level) {
      if (level >= R.AUTOFIRE_LEVEL && !this.autoFireUnlocked) {
        this.autoFireUnlocked = true;
        this.autoFire = true;
        this.events.emit('autofire', true, true);
        this.levelNotes.push(R.t('Авто-огонь открыт!', 'Auto-fire unlocked!'));
      }
      if (level % 5 === 0) this.levelNotes.push(R.t('Монстры быстрее: +5%', 'Monsters are faster: +5%'));
      if (level > 10) this.levelNotes.push(R.t('Монстров стало больше: +20%', 'More monsters: +20%'));
    }

    tryLevelUp() {
      if (this.pendingLevels <= 0 || this.menuOpen || this.ended) return;
      const choices = R.pickThree(this.upgradeLevels);
      if (choices.length === 0) {
        this.pendingLevels = 0;
        return;
      }
      this.pendingLevels--;
      this.menuOpen = true;
      this.events.emit('levelup', choices, this.upgradeLevels);
      R.platform.gameplayStop(); // the menu is open: nobody is playing
      this.scene.pause();
    }

    onUpgradePicked(id) {
      const upgrade = R.UPGRADES.find((u) => u.id === id);
      if (!upgrade || !this.menuOpen) return;
      this.player.applyUpgrade(upgrade);
      this.upgradeLevels[id] = (this.upgradeLevels[id] || 0) + 1;
      this.menuOpen = false;
      this.events.emit('hp', this.player.stats.hp, this.player.stats.maxHp);
      this.scene.resume();
      R.platform.gameplayStart();
      if (this.levelNotes.length) {
        this.events.emit('banner', [...new Set(this.levelNotes)].join('\n'), '#ffd9a0');
        this.levelNotes = [];
      }
      this.tryLevelUp();
    }

    // ---- campfire, sky, ending ------------------------------------------

    updateFire(dt) {
      const C = R.CONFIG;
      const p = this.player;
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.centerX, this.centerY);
      if (d <= C.FIRE_RADIUS && p.stats.hp < p.stats.maxHp) {
        p.heal(C.FIRE_HEAL * dt);
        this.events.emit('hp', p.stats.hp, p.stats.maxHp);
      }
    }

    updateSky(f) {
      const C = R.CONFIG;
      const t = Phaser.Math.Clamp((f - 0.8) / 0.2, 0, 1);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(C.NIGHT_COLOR),
        Phaser.Display.Color.ValueToColor(C.DAWN_COLOR),
        100,
        t * 100
      );
      const color = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      this.shade.setFillStyle(color, 0.45 - 0.35 * t);
      this.cameras.main.setBackgroundColor(color);
    }

    startDawn() {
      this.dawning = true;
      const burning = this.enemies.getChildren().filter((e) => e.active);
      for (const e of burning) e.setVelocity(0, 0);
      this.tweens.add({ targets: burning, alpha: 0, duration: 1000 });
      this.cameras.main.flash(900, 255, 220, 160);
      this.time.delayedCall(1000, () => this.endGame(true));
    }

    endGame(won) {
      if (this.ended) return;
      this.ended = true;
      const seconds = Math.min(this.elapsed, R.CONFIG.NIGHT_SECONDS);
      R.platform.gameplayStop();
      this.scene.stop('UIScene');
      this.scene.start('EndScene', { won, seconds, kills: this.kills, diamonds: this.diamondCount });
    }
  };
})();
