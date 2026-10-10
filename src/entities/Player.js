(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  R.Player = class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
      super(scene, x, y, 'player');
      scene.add.existing(this);
      scene.physics.add.existing(this);

      // base stats + permanent upgrades bought in the shop
      this.stats = Object.assign({}, R.CONFIG.player);
      R.applyShop(this.stats, R.loadShop().levels);
      this.lastShot = -1e9;
      this.dashStart = -1e9;
      this.dashDir = { x: 1, y: 0 };

      // texture is 56x48 with the body centre at (24,24)
      this.setOrigin(24 / 56, 0.5);
      this.setCircle(14, 10, 10);
      this.setCollideWorldBounds(true);
      this.setDepth(10);
    }

    // pointer: Phaser.Input.Pointer
    // aim: optional {x, y} world point to face instead of the mouse
    update(pointer, camera, aim, nowMs) {
      if (this.isDashing(nowMs)) {
        const dash = R.CONFIG.dash;
        const speed = (dash.distance / dash.duration) * 1000;
        this.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
        this.setAlpha(0.55);
      } else {
        this.setAlpha(1);
        // WASD / arrows come from R.held, which survives scene pauses (see HeldKeys.js)
        let { x: vx, y: vy } = R.held.move();
        const len = Math.hypot(vx, vy);
        if (len > 0) {
          vx /= len;
          vy /= len;
        }
        this.setVelocity(vx * this.stats.speed, vy * this.stats.speed);
      }

      pointer.updateWorldPoint(camera);
      const tx = aim ? aim.x : pointer.worldX;
      const ty = aim ? aim.y : pointer.worldY;
      this.rotation = Phaser.Math.Angle.Between(this.x, this.y, tx, ty);
    }

    // nowMs: game-time in ms (does not advance while the scene is paused)
    // intervalMs: time between shots of the current weapon (defaults to the pistol's)
    canFire(nowMs, wantFire, intervalMs) {
      if (!wantFire) return false;
      if (nowMs - this.lastShot < (intervalMs || 1000 / this.stats.fireRate)) return false;
      this.lastShot = nowMs;
      return true;
    }

    dashStatus(nowMs) {
      return R.dashStatus(nowMs, this.dashStart, R.CONFIG.dash.duration, this.stats.dashCooldown);
    }

    canDash(nowMs) {
      return this.dashStatus(nowMs).ready;
    }

    // Invulnerable while dashing.
    isDashing(nowMs) {
      return this.dashStatus(nowMs).active;
    }

    startDash(nowMs, dx, dy) {
      const len = Math.hypot(dx, dy) || 1;
      this.dashDir = { x: dx / len, y: dy / len };
      this.dashStart = nowMs;
    }

    takeDamage(amount) {
      this.stats.hp = Math.max(0, this.stats.hp - amount);
      this.setTint(0xff6666);
      this.scene.time.delayedCall(90, () => this.active && this.clearTint());
    }

    heal(amount) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    }

    applyUpgrade(upgrade) {
      upgrade.apply(this.stats);
    }
  };
})();
