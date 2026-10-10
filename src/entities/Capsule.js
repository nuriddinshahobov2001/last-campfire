(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Protective capsule: one stored charge, activated with E. For a few seconds a dome around
  // the player makes them invulnerable, pushes monsters out and swallows acid. Used by GameScene.
  R.CapsuleShield = class CapsuleShield {
    constructor(scene) {
      this.scene = scene;
      this.charges = 0;
      this.until = 0; // game time (ms) when the dome ends
      this.img = null;
    }

    isActive(nowMs) {
      return nowMs < this.until;
    }

    leftMs(nowMs) {
      return Math.max(0, this.until - nowMs);
    }

    // A capsule was found (at x, y).
    grant(x, y) {
      const s = this.scene;
      if (this.charges > 0 || this.isActive(s.elapsed * 1000)) {
        s.floatText(x, y - 14, R.t('Капсула уже есть', 'You already have a capsule'), '#9be4ff');
        return;
      }
      this.charges = 1;
      s.floatText(x, y - 14, R.t('Капсула защиты! [E]', 'Protective capsule! [E]'), '#6fe8ff');
    }

    activate(nowMs) {
      if (this.charges <= 0 || this.isActive(nowMs)) return false;
      const s = this.scene;
      const p = s.player;
      this.charges = 0;
      this.until = nowMs + R.CONFIG.capsule.duration;
      this.img = s.add.image(p.x, p.y, 'capsule').setDepth(11).setAlpha(0.9);
      s.ringFx(p.x, p.y, R.CONFIG.capsule.radius, 0x6fe8ff);
      return true;
    }

    update(nowMs) {
      if (!this.img) return;
      const s = this.scene;
      const p = s.player;
      const C = R.CONFIG.capsule;
      if (nowMs >= this.until) {
        const img = this.img;
        this.img = null;
        s.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
        return;
      }
      this.img.setPosition(p.x, p.y);
      this.img.setScale(1 + 0.03 * Math.sin(nowMs / 120));
      const blink = this.until - nowMs < 1500 && Math.floor(nowMs / 120) % 2 === 0; // about to end
      this.img.setAlpha(blink ? 0.3 : 0.9);

      for (const e of s.enemies.getChildren()) {
        if (!e.active) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < C.radius + e.def.radius) {
          const k = C.push * (e.def.boss ? 0.5 : 1);
          e.setVelocity((dx / d) * k, (dy / d) * k);
        }
      }
      for (const b of s.abilities.spits.getChildren()) {
        if (b.active && Math.hypot(b.x - p.x, b.y - p.y) < C.radius) {
          s.sparks.explode(4, b.x, b.y);
          b.disableBody(true, true);
        }
      }
    }
  };
})();
