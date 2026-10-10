(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  R.spawnPerSec = function (f) {
    return 0.6 + 1.6 * f;
  };

  // After player level 10, every extra level adds 20% more monsters.
  R.spawnMultiplier = function (level) {
    return level > 10 ? 1 + 0.2 * (level - 10) : 1;
  };

  // Monsters walk 5% faster for every 5 player levels.
  R.enemySpeedMultiplier = function (level) {
    return 1 + 0.05 * Math.floor(level / 5);
  };

  // Auto-fire switches on when the player reaches this level.
  R.AUTOFIRE_LEVEL = 5;

  // A boss wave comes at these fractions of the night (60 s, 120 s, 180 s, 240 s of 300 s).
  R.BOSS_AT = [0.2, 0.4, 0.6, 0.8];
  // Who comes in each wave: three different bosses, two together at the end.
  R.BOSS_WAVES = [['boss'], ['colossus'], ['wraith'], ['boss', 'colossus']];

  // Boss types to spawn for the waves whose threshold lies in (prevF, f].
  R.bossTypesCrossed = function (prevF, f) {
    const out = [];
    R.BOSS_AT.forEach((x, i) => {
      if (x > prevF && x <= f) out.push(...R.BOSS_WAVES[i]);
    });
    return out;
  };

  // Who can spawn from fraction `from` of the night on: [type, weight] pairs.
  R.SPAWN_STAGES = [
    { from: 0, weights: [['walker', 1]] },
    { from: 0.15, weights: [['walker', 3], ['runner', 1]] },
    { from: 0.2, weights: [['walker', 5], ['runner', 3], ['spitter', 2]] },
    { from: 0.3, weights: [['walker', 5], ['runner', 3], ['spitter', 2], ['exploder', 2], ['golem', 1]] },
    { from: 0.4, weights: [['walker', 5], ['runner', 3], ['spitter', 2], ['exploder', 2], ['golem', 1], ['brute', 1]] },
    { from: 0.5, weights: [['walker', 5], ['runner', 3], ['spitter', 2], ['exploder', 2], ['golem', 1], ['brute', 1], ['healer', 1]] },
  ];

  R.pickEnemyType = function (f, rng) {
    rng = rng || Math.random;
    let table = R.SPAWN_STAGES[0].weights;
    for (const stage of R.SPAWN_STAGES) if (f >= stage.from) table = stage.weights;

    let total = 0;
    for (const entry of table) total += entry[1];
    let r = rng() * total;
    for (const entry of table) {
      if (r < entry[1]) return entry[0];
      r -= entry[1];
    }
    return table[0][0];
  };

  R.Spawner = class Spawner {
    constructor(rng) {
      this.rng = rng || Math.random;
      this.acc = 0;
    }

    // Returns the enemy types to create this frame.
    // mult: horde multiplier from R.spawnMultiplier(level)
    update(dtSec, f, alive, mult) {
      this.acc += R.spawnPerSec(f) * (mult || 1) * dtSec;
      const room = R.CONFIG.MAX_ENEMIES - alive;
      const out = [];
      while (this.acc >= 1 && out.length < room) {
        out.push(R.pickEnemyType(f, this.rng));
        this.acc -= 1;
      }
      // At the cap, do not bank spawns: no burst when room opens up.
      if (this.acc > 1) this.acc = 1;
      return out;
    }
  };
})();
