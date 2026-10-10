(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Flying helper: hovers on a slowly turning circle around the player and shoots the
  // nearest monster in range by itself. Not a physics object: monsters cannot touch it.
  R.Drone = class Drone {
    constructor(scene, index) {
      this.scene = scene;
      this.index = index; // which slot on the circle
      this.x = scene.player.x;
      this.y = scene.player.y - 40;
      this.phase = Math.random() * 6;
      this.lastShot = -1e9;
      this.shadow = scene.add.ellipse(this.x, this.y + 20, 24, 9, 0x000000, 0.35).setDepth(8);
      this.img = scene.add.image(this.x, this.y, 'drone').setDepth(12);
    }

    update(nowMs, dt, count) {
      const s = this.scene;
      const p = s.player;
      const D = R.CONFIG.drone;

      // glide towards the slot (smooth, frame-rate independent)
      const slot = R.droneSlot(this.index, count, s.elapsed, D.orbitRadius, D.spin);
      const k = 1 - Math.exp(-6 * dt);
      this.x += (p.x + slot.x - this.x) * k;
      this.y += (p.y + slot.y - this.y) * k;
      const bob = Math.sin(s.elapsed * 5 + this.phase) * 2.5;

      // face the target, or where the player looks
      const target = R.nearestTarget(this.x, this.y, s.enemies.getChildren(), D.range);
      const want = target ? Math.atan2(target.y - this.y, target.x - this.x) : p.rotation;
      this.img.rotation = Phaser.Math.Angle.RotateTo(this.img.rotation, want, 0.3);
      this.img.setPosition(this.x, this.y + bob);
      this.shadow.setPosition(this.x, this.y + 20).setScale(1 - bob * 0.04);

      if (target && nowMs - this.lastShot >= D.interval) {
        this.lastShot = nowMs;
        s.fireDroneShot(this.x, this.y, Math.atan2(target.y - this.y, target.x - this.x), nowMs);
      }
    }
  };
})();
