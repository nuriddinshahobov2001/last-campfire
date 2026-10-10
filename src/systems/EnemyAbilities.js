(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Special behaviour of the new monsters: spitters shoot acid, healers pulse health into
  // their allies, exploders blow up. Created and updated by GameScene.
  R.EnemyAbilities = class EnemyAbilities {
    constructor(scene) {
      this.scene = scene;
      this.spits = scene.physics.add.group({ defaultKey: 'spit', maxSize: 40 });
    }

    update(nowMs) {
      const s = this.scene;
      const p = s.player;
      for (const e of s.enemies.getChildren()) {
        if (!e.active || s.dawning) continue;
        const def = e.def;
        if (!def.ranged && !def.heals) continue;
        if (e.nextAbilityAt < 0) e.nextAbilityAt = nowMs + 400 + Math.random() * 900;
        if (nowMs < e.nextAbilityAt) continue;
        if (def.ranged) {
          const dist = Math.hypot(p.x - e.x, p.y - e.y);
          if (dist <= def.ranged.range) {
            this.spit(e, nowMs);
            e.nextAbilityAt = nowMs + def.ranged.every;
          } else {
            e.nextAbilityAt = nowMs + 300;
          }
        } else {
          this.pulse(e);
          e.nextAbilityAt = nowMs + def.heals.every;
        }
      }
      for (const b of this.spits.getChildren()) {
        if (b.active && nowMs >= b.expireAt) b.disableBody(true, true);
      }
    }

    spit(enemy, nowMs) {
      const p = this.scene.player;
      const r = enemy.def.ranged;
      const a = Math.atan2(p.y - enemy.y, p.x - enemy.x);
      this.shoot(enemy.x, enemy.y, a, { tex: 'spit', size: 14, r: 5, speed: r.speed, damage: r.damage }, nowMs);
    }

    // A hostile projectile (acid, boulder). o: { tex, size, r, speed, damage, life?, spin? }.
    // Hits the player, dies on crates, is swallowed by the capsule.
    shoot(x, y, angle, o, nowMs) {
      const b = this.spits.get(x, y);
      if (!b) return null;
      b.enableBody(true, x, y, true, true);
      b.setTexture(o.tex);
      b.setRotation(0);
      b.setDepth(6);
      b.setCircle(o.r, o.size / 2 - o.r, o.size / 2 - o.r);
      b.setAngularVelocity(o.spin || 0);
      this.scene.physics.velocityFromRotation(angle, o.speed, b.body.velocity);
      b.damage = o.damage;
      b.expireAt = nowMs + (o.life || 2400);
      return b;
    }

    // Heals every other (non-boss) monster in reach by a part of its maximum health.
    pulse(healer) {
      const s = this.scene;
      const h = healer.def.heals;
      s.ringFx(healer.x, healer.y, h.radius, 0x6aff8a);
      for (const e of s.enemies.getChildren()) {
        if (!e.active || e === healer || e.def.boss) continue;
        if (Math.hypot(e.x - healer.x, e.y - healer.y) > h.radius || e.hp >= e.maxHp) continue;
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * h.amount);
        s.floatText(e.x, e.y - 18, '+', '#6aff8a');
      }
    }

    // Explosion of an exploder: hurts the player if close (nothing else).
    blast(x, y, explodes) {
      const s = this.scene;
      s.blastFx(x, y, explodes.radius, 0xff5a2a);
      const p = s.player;
      if (Math.hypot(p.x - x, p.y - y) <= explodes.radius) s.hurtPlayer(explodes.damage);
    }
  };
})();
