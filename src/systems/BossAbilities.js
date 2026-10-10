(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});
  const TAU = Math.PI * 2;

  // Special attacks of the bosses (data: R.BOSS_SKILLS). Each boss walks towards the player
  // until its next attack, shows a warning (windup), attacks, then stands still for a moment.
  // State lives on the enemy as `e.ai`: idle -> windup -> (act ->) recover -> idle.
  R.BossAbilities = class BossAbilities {
    constructor(scene) {
      this.scene = scene;
      this.gfx = scene.add.graphics().setDepth(7); // warnings on the ground
    }

    update(nowMs) {
      const s = this.scene;
      this.gfx.clear();
      for (const e of s.enemies.getChildren()) {
        if (!e.active || !e.def.boss) continue;
        const skills = R.BOSS_SKILLS[e.type];
        if (!skills) continue;
        if (!e.ai) {
          e.ai = { state: 'idle', nextAt: nowMs + R.BOSS_AI.firstDelay, readyAt: {}, lastId: null, skill: null, until: 0, startedAt: 0 };
        }
        if (s.dawning) {
          this.reset(e);
          continue;
        }
        this.step(e, skills, nowMs);
      }
    }

    reset(e) {
      e.ai.state = 'idle';
      e.dmgMul = 1;
      e.setAlpha(1);
      e.clearTint();
    }

    step(e, skills, nowMs) {
      const ai = e.ai;
      if (ai.state === 'idle') {
        if (nowMs < ai.nextAt) return;
        const skill = R.chooseBossSkill(skills, ai.readyAt, nowMs, ai.lastId);
        if (skill) this.begin(e, skill, nowMs);
        else ai.nextAt = nowMs + 400;
      } else if (ai.state === 'windup') {
        this.telegraph(e, nowMs);
        if (nowMs >= ai.until) this.execute(e, nowMs);
      } else if (ai.state === 'act') {
        // the charge: keep running along the line locked at the start
        e.setVelocity(ai.dir.x * ai.skill.speed, ai.dir.y * ai.skill.speed);
        if (nowMs >= ai.until) this.finish(e, nowMs);
      } else if (ai.state === 'recover') {
        e.setVelocity(0, 0);
        if (nowMs >= ai.until) {
          const [lo, hi] = R.BOSS_AI.gap;
          ai.state = 'idle';
          ai.nextAt = nowMs + lo + Math.random() * (hi - lo);
        }
      }
    }

    begin(e, skill, nowMs) {
      const s = this.scene;
      const p = s.player;
      const ai = e.ai;
      ai.state = 'windup';
      ai.skill = skill;
      ai.startedAt = nowMs;
      ai.until = nowMs + skill.windup;
      ai.lastId = skill.id;
      ai.readyAt[skill.id] = nowMs + skill.cooldown;
      e.setVelocity(0, 0);

      // the target is locked now, so the warning shows the truth and the player can dodge it
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      ai.dir = { x: dx / d, y: dy / d };
      ai.angle = Math.atan2(dy, dx);
      e.rotation = ai.angle;
      if (skill.id === 'blink') {
        const C = R.CONFIG;
        const a = Math.random() * TAU;
        ai.dest = {
          x: Phaser.Math.Clamp(p.x + Math.cos(a) * skill.distance, 40, C.WORLD_W - 40),
          y: Phaser.Math.Clamp(p.y + Math.sin(a) * skill.distance, 40, C.WORLD_H - 40),
        };
      }
      s.floatText(e.x, e.y - e.def.radius - 24, R.tt(skill.label), '#ff8a5a');
    }

    // The warning: where and when it will hit.
    telegraph(e, nowMs) {
      const ai = e.ai;
      const sk = ai.skill;
      const g = this.gfx;
      const t = Math.min(1, (nowMs - ai.startedAt) / sk.windup);
      const pulse = 0.5 + 0.5 * Math.sin(nowMs / 70);
      e.setTint(Math.floor(nowMs / 90) % 2 === 0 ? 0xffa0a0 : 0xffffff);

      if (sk.id === 'charge') {
        const len = (sk.speed * sk.duration) / 1000;
        g.lineStyle(e.def.radius * 2, 0xff3030, 0.12 + 0.14 * pulse);
        g.lineBetween(e.x, e.y, e.x + ai.dir.x * len, e.y + ai.dir.y * len);
      } else if (sk.id === 'slam') {
        g.fillStyle(0xff7a2a, 0.1 + 0.12 * t).fillCircle(e.x, e.y, sk.radius * t);
        g.lineStyle(3, 0xff9a4a, 0.7).strokeCircle(e.x, e.y, sk.radius);
      } else if (sk.id === 'rocks') {
        for (let i = 0; i < sk.count; i++) {
          const a = ai.angle + (i - (sk.count - 1) / 2) * Phaser.Math.DegToRad(sk.spread);
          g.lineStyle(4, 0xffc060, 0.25 + 0.3 * pulse);
          g.lineBetween(e.x, e.y, e.x + Math.cos(a) * 420, e.y + Math.sin(a) * 420);
        }
      } else if (sk.id === 'blink') {
        e.setAlpha(0.3 + 0.3 * pulse);
        g.lineStyle(3, 0xb08aff, 0.9).strokeCircle(ai.dest.x, ai.dest.y, 40 - 14 * t);
        g.fillStyle(0xb08aff, 0.18 + 0.2 * pulse).fillCircle(ai.dest.x, ai.dest.y, 36);
      } else if (sk.id === 'summon') {
        g.lineStyle(3, 0xb08aff, 0.8).strokeCircle(e.x, e.y, 30 + 70 * t);
      }
    }

    execute(e, nowMs) {
      const s = this.scene;
      const p = s.player;
      const ai = e.ai;
      const sk = ai.skill;
      e.clearTint();

      if (sk.id === 'charge') {
        ai.state = 'act';
        ai.until = nowMs + sk.duration;
        e.dmgMul = sk.dmgMul;
        s.sparks.explode(14, e.x, e.y);
        return;
      }
      if (sk.id === 'slam') {
        s.blastFx(e.x, e.y, sk.radius, 0xffb040);
        if (Math.hypot(p.x - e.x, p.y - e.y) <= sk.radius) s.hurtPlayer(sk.damage);
      } else if (sk.id === 'rocks') {
        for (let i = 0; i < sk.count; i++) {
          const a = ai.angle + (i - (sk.count - 1) / 2) * Phaser.Math.DegToRad(sk.spread);
          const x = e.x + Math.cos(a) * e.def.radius;
          const y = e.y + Math.sin(a) * e.def.radius;
          s.abilities.shoot(x, y, a, { tex: 'boulder', size: 26, r: 11, speed: sk.speed, damage: sk.damage, life: 2600, spin: 360 }, nowMs);
        }
      } else if (sk.id === 'blink') {
        s.sparks.explode(16, e.x, e.y);
        e.body.reset(ai.dest.x, ai.dest.y);
        s.sparks.explode(16, e.x, e.y);
        s.ringFx(e.x, e.y, 60, 0xb08aff);
      } else if (sk.id === 'summon') {
        s.ringFx(e.x, e.y, 90, 0xb08aff);
        const alive = s.enemies.getChildren().filter((g) => g.active && g.type === 'ghost').length;
        const n = Math.min(sk.count, sk.max - alive);
        for (let i = 0; i < n; i++) {
          const a = (i / sk.count) * TAU + Math.random();
          const x = e.x + Math.cos(a) * (e.def.radius + 24);
          const y = e.y + Math.sin(a) * (e.def.radius + 24);
          const ghost = s.enemies.get(x, y, 'ghost');
          if (ghost) ghost.spawn('ghost', x, y, 1);
        }
      }
      this.finish(e, nowMs);
    }

    // After an attack the boss stands still for a moment, then walks again.
    finish(e, nowMs) {
      const ai = e.ai;
      ai.state = 'recover';
      ai.until = nowMs + R.BOSS_AI.recover;
      e.dmgMul = 1;
      e.setAlpha(1);
      e.clearTint();
      e.setVelocity(0, 0);
    }
  };
})();
