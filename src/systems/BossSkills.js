(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Special attacks of each boss. windup = warning time (ms) before the attack lands,
  // cooldown = time (ms) from the start of the attack until it may be used again.
  R.BOSS_SKILLS = {
    boss: [
      // Demon: locks on to you, then charges in a straight line (hits harder while charging)
      { id: 'charge', label: ['РЫВОК!', 'CHARGE!'], cooldown: 6500, windup: 800, duration: 600, speed: 640, dmgMul: 1.6 },
      // Demon: shockwave around itself
      { id: 'slam', label: ['УДАРНАЯ ВОЛНА!', 'SHOCKWAVE!'], cooldown: 8000, windup: 900, radius: 170, damage: 28 },
    ],
    colossus: [
      // Colossus: throws boulders in a fan (spread = degrees between them)
      { id: 'rocks', label: ['КАМНИ!', 'BOULDERS!'], cooldown: 4500, windup: 700, count: 3, spread: 16, speed: 320, damage: 24 },
    ],
    wraith: [
      // Wraith: vanishes and reappears `distance` px from you
      { id: 'blink', label: ['ТЕЛЕПОРТ!', 'TELEPORT!'], cooldown: 5000, windup: 600, distance: 170 },
      // Wraith: calls `count` ghosts (never more than `max` alive)
      { id: 'summon', label: ['ПРИЗЫВ!', 'SUMMON!'], cooldown: 9000, windup: 800, count: 3, max: 8 },
    ],
  };

  // firstDelay: how long a new boss only walks before its first attack; gap: random pause
  // between two attacks; recover: standing still after an attack.
  R.BOSS_AI = { firstDelay: 2500, gap: [1200, 2200], recover: 450 };

  // Picks the next attack: among the skills that are off cooldown (readyAt[id] <= nowMs),
  // not the one used last time if there is a choice. Returns null when none is ready.
  R.chooseBossSkill = function (skills, readyAt, nowMs, lastId, rng) {
    const ready = skills.filter((sk) => (readyAt[sk.id] || 0) <= nowMs);
    if (ready.length === 0) return null;
    const fresh = ready.filter((sk) => sk.id !== lastId);
    const pool = fresh.length > 0 ? fresh : ready;
    return pool[Math.min(pool.length - 1, Math.floor((rng || Math.random)() * pool.length))];
  };
})();
