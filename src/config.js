(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  R.VERSION = '1.0.0'; // keep equal to "version" in package.json (tests check it)

  R.DEBUG = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search);

  R.CONFIG = {
    WIDTH: 1280,
    HEIGHT: 720,
    WORLD_W: 2000,
    WORLD_H: 1500,
    NIGHT_SECONDS: R.DEBUG ? 30 : 300,
    MAX_ENEMIES: 80,
    SPAWN_DISTANCE: 700,
    CONTACT_COOLDOWN: 800,
    FIRE_RADIUS: 120,
    FIRE_HEAL: 5,
    ENEMY_HP_GROWTH: 0.3,
    CRYSTAL_SPEED: 350,
    MAP_R: 96, // minimap radius on screen (px)
    MAP_RANGE: 750, // world distance (px) from the minimap centre to its edge
    NIGHT_COLOR: 0x0a0f1f,
    DAWN_COLOR: 0xffb36b,
    player: {
      maxHp: 120,
      hp: 120,
      speed: 200,
      fireRate: 5,
      damage: 12,
      bulletSpeed: 600,
      bulletLife: 1000,
      pierce: 0,
      shots: 1,
      pickupRadius: 100,
      dashCooldown: 2500, // ms, counted from the start of a dash
      drones: 1, // flying helpers
    },
    // Q: fire ring. Hurts everything around the player, knocks monsters back and sets them on fire.
    ability: { cooldown: 18000, duration: 450, radius: 280, damageMul: 5, knock: 380, burnMs: 3000, burnFrac: 0.12 },
    // flying helper: hovers around the player and shoots the nearest monster by itself
    drone: { range: 420, interval: 500, damageMul: 0.4, speed: 700, life: 700, orbitRadius: 64, spin: 1.4 },
    // protective capsule: a dome around the player; invulnerable, monsters are pushed away
    capsule: { duration: 8000, radius: 130, push: 320 },
    // Shift: a short burst in the move direction; invulnerable while it lasts
    dash: { distance: 180, duration: 150 },
    // breakable wooden crates: solid cover that drops loot when shot to pieces
    crates: {
      hp: 30,
      size: 44,
      count: 14,
      respawnSec: 15,
      healAmount: 40,
      xpCrystals: 3,
      xpEach: 2,
      magnetSec: 3,
    },
    enemies: {
      // radius = hitbox, size = texture side in px (centre of texture = centre of body)
      walker: { hp: 20, speed: 70, damage: 8, xp: 1, radius: 14, size: 44 },
      runner: { hp: 10, speed: 130, damage: 5, xp: 1, radius: 10, size: 36 },
      brute: { hp: 80, speed: 45, damage: 15, xp: 4, radius: 22, size: 70 },
      // spitter: keeps its distance and spits acid; exploder: runs at you and blows up;
      // healer: stays behind the others and heals them in pulses
      spitter: { hp: 18, speed: 62, damage: 6, xp: 2, radius: 14, size: 44, keep: 330, ranged: { every: 2000, range: 560, speed: 260, damage: 10 } },
      exploder: { hp: 12, speed: 150, damage: 0, xp: 2, radius: 13, size: 40, explodes: { radius: 95, damage: 25 } },
      healer: { hp: 30, speed: 56, damage: 4, xp: 3, radius: 15, size: 46, keep: 430, heals: { radius: 230, every: 2600, amount: 0.3 } },
      // ghost: summoned by the Wraith boss, never spawns on its own
      ghost: { hp: 8, speed: 125, damage: 5, xp: 1, radius: 10, size: 34 },
      // stone golem: slow, very tough regular monster
      golem: { hp: 160, speed: 38, damage: 18, xp: 6, radius: 26, size: 80 },
      // bosses come in waves (see R.BOSS_WAVES); each drops `diamonds` diamonds
      boss: { boss: true, name: ['ДЕМОН', 'DEMON'], hp: 500, speed: 55, damage: 25, xp: 10, radius: 40, size: 120, diamonds: 5 },
      colossus: { boss: true, name: ['КАМЕННЫЙ КОЛОСС', 'STONE COLOSSUS'], hp: 1100, speed: 30, damage: 35, xp: 16, radius: 52, size: 150, diamonds: 5 },
      wraith: { boss: true, name: ['ПРИЗРАК', 'WRAITH'], hp: 380, speed: 105, damage: 20, xp: 12, radius: 32, size: 110, diamonds: 5 },
    },
  };

  R.formatTime = function (seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  };

  const BEST_KEY = 'rassvet.best';
  const BEST_DIAMONDS_KEY = 'rassvet.bestDiamonds';

  R.loadBest = function () {
    try {
      const v = Number(R.storage.getItem(BEST_KEY));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  };

  R.loadBestDiamonds = function () {
    try {
      const v = Number(R.storage.getItem(BEST_DIAMONDS_KEY));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  };

  R.saveBestDiamonds = function (count) {
    try {
      if (count > R.loadBestDiamonds()) R.storage.setItem(BEST_DIAMONDS_KEY, String(count));
    } catch (e) {
      /* storage unavailable: play without saving */
    }
  };

  R.saveBest = function (seconds) {
    try {
      if (seconds > R.loadBest()) R.storage.setItem(BEST_KEY, String(seconds));
    } catch (e) {
      /* storage unavailable: play without saving */
    }
  };
})();
