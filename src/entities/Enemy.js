(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Pooled: created by a physics group (classType), reused through spawn().
  R.Enemy = class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, key, frame) {
      super(scene, x, y, key || 'walker', frame);
      this.lastHitAt = -1e9;
      this.nextAbilityAt = -1;
      this.dmgMul = 1;
      this.burnUntil = 0;
      this.knockUntil = 0;
    }

    spawn(type, x, y, hpScale) {
      const def = R.CONFIG.enemies[type];
      this.type = type;
      this.def = def;
      this.enableBody(true, x, y, true, true);
      this.setTexture(type);
      const inset = def.size / 2 - def.radius;
      this.setCircle(def.radius, inset, inset);
      this.phase = Math.random() * Math.PI * 2;
      this.setDepth(5);
      this.setAlpha(1);
      this.clearTint();
      this.hp = def.hp * hpScale;
      this.maxHp = this.hp;
      this.lastHitAt = -1e9;
      this.nextAbilityAt = -1; // set by EnemyAbilities on the first check
      this.ai = null; // boss attack state, see BossAbilities
      this.dmgMul = 1; // contact damage multiplier (a charging boss hits harder)
      this.burning = false; // set alight by the Q fire ring
      this.burnUntil = 0;
      this.nextBurn = 0;
      this.knockUntil = 0; // knocked back by the fire ring: does not chase until then
    }

    chase(target) {
      // monsters speed up as the player levels (+5% per 5 levels) and during some night events
      const speed = this.def.speed * (this.scene.enemySpeedMult || 1);
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      // ranged / support monsters hold a distance: back off when too close, stand when in range
      let dir = 1;
      const keep = this.def.keep;
      if (keep) {
        if (dist < keep - 50) dir = -1;
        else if (dist < keep + 30) dir = 0;
      }
      this.setVelocity((dx / dist) * speed * dir, (dy / dist) * speed * dir);
      // face the target, with a small sway while walking
      const sway = dir === 0 ? 0 : Math.sin(this.scene.elapsed * this.def.speed * 0.14 + this.phase) * 0.14;
      this.rotation = Math.atan2(dy, dx) + sway;
    }

    // Returns true when the enemy died.
    hit(damage) {
      this.hp -= damage;
      if (this.hp > 0) {
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(50, () => this.active && this.clearTint());
      }
      return this.hp <= 0;
    }
  };
})();
