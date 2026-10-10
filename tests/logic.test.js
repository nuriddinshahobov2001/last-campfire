const assert = require('node:assert/strict');

require('../src/i18n.js');
require('../src/storage.js');
require('../src/config.js');
require('../src/upgrades.js');
require('../src/systems/Spawner.js');
require('../src/systems/Weapons.js');
require('../src/systems/Events.js');
require('../src/systems/Crates.js');
require('../src/systems/Dash.js');
require('../src/systems/HeldKeys.js');
require('../src/systems/Drone.js');
require('../src/systems/BossSkills.js');
require('../src/systems/Shop.js');
require('../src/platform.js');

const R = globalThis.Rassvet;
let passed = 0;
const pending = []; // async tests

function ok(name) {
  passed++;
  console.log('ok   ' + name);
}

function bad(name, e) {
  console.log('FAIL ' + name + '\n     ' + e.message);
  process.exitCode = 1;
}

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') pending.push(result.then(() => ok(name), (e) => bad(name, e)));
    else ok(name);
  } catch (e) {
    bad(name, e);
  }
}

function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('formatTime', () => {
  assert.equal(R.formatTime(300), '5:00');
  assert.equal(R.formatTime(61), '1:01');
  assert.equal(R.formatTime(0.2), '0:01');
  assert.equal(R.formatTime(-5), '0:00');
});

test('loadBest/saveBest work without localStorage (memory fallback)', () => {
  R.storage.clearMemory();
  assert.equal(R.loadBest(), 0);
  R.saveBest(10);
  assert.equal(R.loadBest(), 10);
  R.saveBest(4); // a worse time never replaces the best one
  assert.equal(R.loadBest(), 10);
  R.storage.clearMemory();
});

test('xpForLevel', () => {
  assert.equal(R.xpForLevel(1), 4);
  assert.equal(R.xpForLevel(2), 6);
  assert.equal(R.xpForLevel(4), 10);
});

test('spawnPerSec', () => {
  assert.ok(Math.abs(R.spawnPerSec(0) - 0.6) < 1e-9);
  assert.ok(Math.abs(R.spawnPerSec(1) - 2.2) < 1e-9);
});

test('pickEnemyType: only walkers before f=0.15', () => {
  for (const r of [0, 0.3, 0.99]) assert.equal(R.pickEnemyType(0.1, () => r), 'walker');
  assert.equal(R.pickEnemyType(0.149, () => 0.99), 'walker');
});

test('spawn stages: every monster appears at its time and not before', () => {
  const first = {};
  for (const st of R.SPAWN_STAGES) for (const [t] of st.weights) if (!(t in first)) first[t] = st.from;
  assert.deepEqual(first, { walker: 0, runner: 0.15, spitter: 0.2, exploder: 0.3, golem: 0.3, brute: 0.4, healer: 0.5 });
});

test('spawn stages: later stages start later and keep every earlier monster', () => {
  for (let i = 1; i < R.SPAWN_STAGES.length; i++) {
    const prev = R.SPAWN_STAGES[i - 1];
    const cur = R.SPAWN_STAGES[i];
    assert.ok(cur.from > prev.from);
    const types = cur.weights.map((w) => w[0]);
    for (const [t] of prev.weights) assert.ok(types.includes(t), t + ' vanished at ' + cur.from);
  }
});

test('pickEnemyType: rng 0 gives the first entry of a stage, rng ~1 the last', () => {
  for (const st of R.SPAWN_STAGES) {
    const f = Math.min(1, st.from + 1e-6);
    assert.equal(R.pickEnemyType(f, () => 0), st.weights[0][0]);
    assert.equal(R.pickEnemyType(f, () => 0.999999), st.weights[st.weights.length - 1][0]);
  }
});

test('pickEnemyType: rolls follow the stage weights', () => {
  for (const f of [0.17, 0.25, 0.35, 0.45, 0.9]) {
    const stage = [...R.SPAWN_STAGES].reverse().find((st) => st.from <= f);
    const total = stage.weights.reduce((n, w) => n + w[1], 0);
    const counts = {};
    for (let i = 0; i < 10000; i++) {
      const t = R.pickEnemyType(f, () => i / 10000);
      counts[t] = (counts[t] || 0) + 1;
    }
    for (const [t, w] of stage.weights) assert.ok(Math.abs(counts[t] - (10000 * w) / total) <= 2, f + ' ' + t);
  }
});

test('pickEnemyType never returns a boss', () => {
  for (const f of [0, 0.2, 0.3, 0.5, 1]) {
    for (let i = 0; i < 100; i++) {
      assert.ok(!R.CONFIG.enemies[R.pickEnemyType(f)].boss);
    }
  }
});

test('pickThree: 3 distinct upgrades', () => {
  const picked = R.pickThree({});
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((u) => u.id)).size, 3);
});

test('pickThree: skips maxed upgrades', () => {
  const levels = {};
  for (const u of R.UPGRADES) levels[u.id] = u.max;
  levels.damage = 0;
  levels.pierce = 1;
  const picked = R.pickThree(levels);
  assert.deepEqual(picked.map((u) => u.id).sort(), ['damage', 'pierce']);
});

test('pickThree: nothing available returns []', () => {
  const levels = {};
  for (const u of R.UPGRADES) levels[u.id] = u.max;
  assert.deepEqual(R.pickThree(levels), []);
});

test('pickThree: does not mutate R.UPGRADES order', () => {
  const before = R.UPGRADES.map((u) => u.id).join();
  R.pickThree({}, seq([0.1, 0.9, 0.5]));
  assert.equal(R.UPGRADES.map((u) => u.id).join(), before);
});

test('upgrades apply to stats', () => {
  const s = () => ({ ...R.CONFIG.player });
  const by = (id) => R.UPGRADES.find((u) => u.id === id);
  let st = s();
  by('fireRate').apply(st);
  assert.ok(Math.abs(st.fireRate - 6) < 1e-9);
  st = s();
  by('damage').apply(st);
  assert.ok(Math.abs(st.damage - 15) < 1e-9);
  st = s();
  by('speed').apply(st);
  assert.ok(Math.abs(st.speed - 220) < 1e-9);
  st = s();
  st.hp = 60;
  by('maxHp').apply(st);
  assert.equal(st.maxHp, 145);
  assert.equal(st.hp, 85);
  st = s();
  by('maxHp').apply(st);
  assert.equal(st.hp, 145);
  st = s();
  by('multishot').apply(st);
  assert.equal(st.shots, 2);
  st = s();
  by('pierce').apply(st);
  assert.equal(st.pierce, 1);
});

test('every upgrade has id, name, desc, max, apply', () => {
  for (const u of R.UPGRADES) {
    assert.ok(u.id && u.name && u.desc && u.max > 0 && typeof u.apply === 'function');
  }
  assert.equal(new Set(R.UPGRADES.map((u) => u.id)).size, R.UPGRADES.length);
});

test('Spawner: spawns at the expected rate', () => {
  const sp = new R.Spawner(() => 0);
  let total = 0;
  for (let i = 0; i < 100; i++) total += sp.update(0.1, 0, 0).length; // 10 s at 0.6/s
  assert.ok(total >= 5 && total <= 6, 'spawned ' + total);
});

test('Spawner: never exceeds the alive cap', () => {
  const sp = new R.Spawner(() => 0);
  const out = sp.update(10, 1, R.CONFIG.MAX_ENEMIES - 3);
  assert.equal(out.length, 3);
  assert.equal(sp.update(0.01, 1, R.CONFIG.MAX_ENEMIES).length, 0);
});

test('Spawner: no burst after a long capped period', () => {
  const sp = new R.Spawner(() => 0);
  for (let i = 0; i < 100; i++) sp.update(1, 1, R.CONFIG.MAX_ENEMIES);
  const out = sp.update(0.016, 1, 0);
  assert.ok(out.length <= 1, 'spawned ' + out.length);
});

test('spawnMultiplier: +20% per level after 10', () => {
  assert.equal(R.spawnMultiplier(1), 1);
  assert.equal(R.spawnMultiplier(10), 1);
  assert.ok(Math.abs(R.spawnMultiplier(11) - 1.2) < 1e-9);
  assert.ok(Math.abs(R.spawnMultiplier(15) - 2) < 1e-9);
});

test('Spawner: multiplier scales the spawn rate', () => {
  const base = new R.Spawner(() => 0);
  const boosted = new R.Spawner(() => 0);
  let a = 0;
  let b = 0;
  for (let i = 0; i < 100; i++) {
    a += base.update(0.1, 0, 0).length;
    b += boosted.update(0.1, 0, 0, 2).length;
  }
  assert.ok(b >= 2 * a - 1 && b <= 2 * a + 1, 'base ' + a + ' boosted ' + b);
});

test('bossTypesCrossed: a boss wave every 20% of the night', () => {
  assert.deepEqual(R.bossTypesCrossed(0, 0.19), []);
  assert.deepEqual(R.bossTypesCrossed(0.19, 0.2), ['boss']);
  assert.deepEqual(R.bossTypesCrossed(0.2, 0.3), []);
  assert.deepEqual(R.bossTypesCrossed(0.39, 0.61), ['colossus', 'wraith']);
  assert.deepEqual(R.bossTypesCrossed(0.79, 0.81), ['boss', 'colossus']);
  assert.equal(R.bossTypesCrossed(0, 1).length, 5);
});

test('boss waves use three different bosses, the last wave brings two', () => {
  const kinds = new Set(R.BOSS_WAVES.flat());
  assert.deepEqual([...kinds].sort(), ['boss', 'colossus', 'wraith']);
  assert.equal(R.BOSS_WAVES.length, R.BOSS_AT.length);
  assert.equal(R.BOSS_WAVES[R.BOSS_WAVES.length - 1].length, 2);
});

test('every boss: flag, name, 5 diamonds, tougher than a brute', () => {
  for (const type of ['boss', 'colossus', 'wraith']) {
    const b = R.CONFIG.enemies[type];
    assert.equal(b.boss, true, type);
    assert.ok(b.name, type);
    assert.equal(b.diamonds, 5, type);
    assert.ok(b.hp > R.CONFIG.enemies.brute.hp, type);
    assert.ok(b.size >= 2 * b.radius, type);
  }
});

test('stone golem: lots of HP, slow, not a boss', () => {
  const g = R.CONFIG.enemies.golem;
  assert.ok(g.hp > R.CONFIG.enemies.brute.hp * 1.5);
  assert.ok(g.speed < R.CONFIG.enemies.walker.speed);
  assert.ok(!g.boss && !g.diamonds);
});

test('enemySpeedMultiplier: +5% for every 5 player levels', () => {
  assert.equal(R.enemySpeedMultiplier(1), 1);
  assert.equal(R.enemySpeedMultiplier(4), 1);
  assert.ok(Math.abs(R.enemySpeedMultiplier(5) - 1.05) < 1e-9);
  assert.ok(Math.abs(R.enemySpeedMultiplier(9) - 1.05) < 1e-9);
  assert.ok(Math.abs(R.enemySpeedMultiplier(10) - 1.1) < 1e-9);
  assert.ok(Math.abs(R.enemySpeedMultiplier(25) - 1.25) < 1e-9);
});

test('auto-fire unlocks at level 5', () => {
  assert.equal(R.AUTOFIRE_LEVEL, 5);
});

test('loadBestDiamonds/saveBestDiamonds work without localStorage', () => {
  R.storage.clearMemory();
  assert.equal(R.loadBestDiamonds(), 0);
  R.saveBestDiamonds(7);
  assert.equal(R.loadBestDiamonds(), 7);
  R.storage.clearMemory();
});

test('crate config', () => {
  const c = R.CONFIG.crates;
  assert.ok(c.hp > 0 && c.count > 0 && c.respawnSec > 0 && c.size > 0);
});

test('rollCrateLoot: 26% heal, 26% xp, 12% magnet, 24% weapon, 12% capsule', () => {
  assert.equal(R.rollCrateLoot(() => 0), 'heal');
  assert.equal(R.rollCrateLoot(() => 0.259), 'heal');
  assert.equal(R.rollCrateLoot(() => 0.26), 'xp');
  assert.equal(R.rollCrateLoot(() => 0.519), 'xp');
  assert.equal(R.rollCrateLoot(() => 0.52), 'magnet');
  assert.equal(R.rollCrateLoot(() => 0.639), 'magnet');
  assert.equal(R.rollCrateLoot(() => 0.64), 'weapon');
  assert.equal(R.rollCrateLoot(() => 0.879), 'weapon');
  assert.equal(R.rollCrateLoot(() => 0.88), 'capsule');
  assert.equal(R.rollCrateLoot(() => 0.999), 'capsule');
});

test('rollWeapon: only the pick-up weapons, all of them reachable', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(R.rollWeapon(() => i / 300));
  assert.deepEqual([...seen].sort(), ['laser', 'rocket', 'shotgun']);
});

test('pickCrateSpot: stays inside the world and away from avoid zones', () => {
  const avoid = [{ x: 1000, y: 750, r: 260 }];
  for (let i = 0; i < 200; i++) {
    const p = R.pickCrateSpot([], avoid, Math.random);
    assert.ok(p, 'got a spot');
    assert.ok(p.x >= 60 && p.x <= R.CONFIG.WORLD_W - 60 && p.y >= 60 && p.y <= R.CONFIG.WORLD_H - 60);
    assert.ok(Math.hypot(p.x - 1000, p.y - 750) >= 260);
  }
});

test('pickCrateSpot: keeps crates apart from each other', () => {
  const placed = [];
  for (let i = 0; i < R.CONFIG.crates.count; i++) {
    const p = R.pickCrateSpot(placed, [], Math.random);
    assert.ok(p);
    for (const q of placed) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 140);
    placed.push(p);
  }
});

test('pickCrateSpot: null when no room', () => {
  const avoid = [{ x: 1000, y: 750, r: 5000 }];
  assert.equal(R.pickCrateSpot([], avoid, Math.random), null);
});

test('dashStatus: ready before the first dash, active only for its duration', () => {
  const fresh = R.dashStatus(5000, -1e9, 150, 2500);
  assert.equal(fresh.ready, true);
  assert.equal(fresh.active, false);
  const start = R.dashStatus(1000, 1000, 150, 2500);
  assert.equal(start.active, true);
  assert.equal(start.ready, false);
  assert.equal(R.dashStatus(1149, 1000, 150, 2500).active, true);
  assert.equal(R.dashStatus(1150, 1000, 150, 2500).active, false);
});

test('dashStatus: cooldown counts down from the dash start', () => {
  const mid = R.dashStatus(2250, 1000, 150, 2500);
  assert.equal(mid.ready, false);
  assert.equal(mid.cooldownLeft, 1250);
  assert.ok(Math.abs(mid.cooldownFrac - 0.5) < 1e-9);
  assert.equal(R.dashStatus(3500, 1000, 150, 2500).ready, true);
  assert.equal(R.dashStatus(3500, 1000, 150, 2500).cooldownFrac, 1);
});

test('dash config and base cooldown', () => {
  assert.ok(R.CONFIG.dash.distance > 0 && R.CONFIG.dash.duration > 0);
  assert.ok(R.CONFIG.player.dashCooldown > R.CONFIG.dash.duration);
});

test('shop: every item has one cost per level, unique ids', () => {
  assert.equal(new Set(R.SHOP_ITEMS.map((i) => i.id)).size, R.SHOP_ITEMS.length);
  for (const it of R.SHOP_ITEMS) {
    assert.equal(it.costs.length, it.max, it.id);
    assert.ok(it.name && it.desc && typeof it.now === 'function' && typeof it.apply === 'function', it.id);
    for (let i = 1; i < it.costs.length; i++) assert.ok(it.costs[i] >= it.costs[i - 1], it.id);
  }
  assert.ok(R.SHOP_ITEMS.some((i) => i.id === 'dashCd'));
});

test('shopCost: next level price, null at max', () => {
  const it = R.SHOP_ITEMS.find((i) => i.id === 'maxHp');
  assert.equal(R.shopCost(it, 0), it.costs[0]);
  assert.equal(R.shopCost(it, it.max - 1), it.costs[it.max - 1]);
  assert.equal(R.shopCost(it, it.max), null);
});

test('buyUpgrade: pays, levels up, does not mutate the old state', () => {
  const state = { bank: 10, levels: {} };
  const price = R.SHOP_ITEMS.find((i) => i.id === 'damage').costs[0];
  const r = R.buyUpgrade(state, 'damage');
  assert.equal(r.ok, true);
  assert.equal(r.cost, price);
  assert.equal(r.state.bank, 10 - price);
  assert.equal(r.state.levels.damage, 1);
  assert.equal(state.bank, 10);
  assert.deepEqual(state.levels, {});
});

test('buyUpgrade: refuses when poor, maxed or unknown', () => {
  assert.deepEqual([R.buyUpgrade({ bank: 0, levels: {} }, 'damage').ok, R.buyUpgrade({ bank: 0, levels: {} }, 'damage').reason], [false, 'poor']);
  const it = R.SHOP_ITEMS.find((i) => i.id === 'pickup');
  const maxed = R.buyUpgrade({ bank: 999, levels: { pickup: it.max } }, 'pickup');
  assert.deepEqual([maxed.ok, maxed.reason], [false, 'max']);
  assert.equal(R.buyUpgrade({ bank: 999, levels: {} }, 'nope').reason, 'unknown');
});

test('applyShop: permanent bonuses per level', () => {
  const fresh = () => ({ ...R.CONFIG.player });
  let st = fresh();
  R.applyShop(st, { maxHp: 2 });
  assert.equal(st.maxHp, R.CONFIG.player.maxHp + 20);
  assert.equal(st.hp, st.maxHp);
  st = fresh();
  R.applyShop(st, { damage: 3, fireRate: 2, speed: 5, pickup: 3, dashCd: 2 });
  assert.ok(Math.abs(st.damage - R.CONFIG.player.damage * 1.15) < 1e-9);
  assert.ok(Math.abs(st.fireRate - R.CONFIG.player.fireRate * 1.1) < 1e-9);
  assert.ok(Math.abs(st.speed - R.CONFIG.player.speed * 1.15) < 1e-9);
  assert.ok(Math.abs(st.pickupRadius - R.CONFIG.player.pickupRadius * 1.45) < 1e-9);
  assert.ok(Math.abs(st.dashCooldown - R.CONFIG.player.dashCooldown * 0.8) < 1e-9);
  st = fresh();
  R.applyShop(st, {});
  assert.deepEqual(st, R.CONFIG.player);
});

test('shop storage works without localStorage', () => {
  R.storage.clearMemory();
  assert.deepEqual(R.loadShop(), { bank: 0, levels: {} });
  R.saveShop({ bank: 3, levels: { damage: 2 } });
  assert.deepEqual(R.loadShop(), { bank: 3, levels: { damage: 2 } });
  assert.equal(R.addToBank(4).bank, 7);
  assert.equal(R.loadShop().bank, 7);
  R.storage.setItem('rassvet.shop', 'not json'); // damaged save: start fresh instead of crashing
  assert.deepEqual(R.loadShop(), { bank: 0, levels: {} });
  R.storage.clearMemory();
});

test('weapons: four weapons, pistol is the default', () => {
  assert.deepEqual(Object.keys(R.WEAPONS).sort(), ['laser', 'pistol', 'rocket', 'shotgun']);
  for (const w of Object.values(R.WEAPONS)) assert.ok(w.name && w.damageMul > 0 && w.rateMul > 0 && w.tex && R.BULLET_TEX[w.tex], w.id);
  assert.ok(R.WEAPON_DURATION_MS > 0);
});

test('weaponVolley: pistol keeps the old spread', () => {
  const stats = { ...R.CONFIG.player };
  const one = R.weaponVolley(R.WEAPONS.pistol, stats);
  assert.deepEqual(one.angles, [0]);
  assert.equal(one.interval, 200);
  assert.equal(one.damage, stats.damage);
  const two = R.weaponVolley(R.WEAPONS.pistol, { ...stats, shots: 2 });
  assert.equal(two.angles.length, 2);
  assert.ok(Math.abs(two.angles[1] - (6 * Math.PI) / 180) < 1e-9);
  assert.ok(Math.abs(two.angles[0] + (6 * Math.PI) / 180) < 1e-9);
});

test('weaponVolley: shotgun fires many pellets, laser pierces everything, rocket explodes', () => {
  const stats = { ...R.CONFIG.player };
  const sg = R.weaponVolley(R.WEAPONS.shotgun, stats);
  assert.equal(sg.angles.length, 7);
  assert.ok(Math.abs(sg.angles[0] + sg.angles[6]) < 1e-9, 'symmetric');
  assert.ok(sg.interval > 200 && sg.life < R.CONFIG.player.bulletLife);
  assert.equal(R.weaponVolley(R.WEAPONS.shotgun, { ...stats, shots: 3 }).angles.length, 9);
  assert.equal(R.weaponVolley(R.WEAPONS.laser, stats).pierce, 99);
  assert.ok(R.WEAPONS.rocket.explosion.radius > 0);
  assert.ok(R.weaponVolley(R.WEAPONS.rocket, stats).damage > stats.damage);
});

test('weaponVolley: player pierce and fire rate upgrades still count', () => {
  const stats = { ...R.CONFIG.player, pierce: 2, fireRate: 10 };
  assert.equal(R.weaponVolley(R.WEAPONS.pistol, stats).pierce, 2);
  assert.equal(R.weaponVolley(R.WEAPONS.pistol, stats).interval, 100);
});

test('night events: schedule never overlaps and ends before dawn', () => {
  const sched = [...R.EVENT_SCHEDULE].sort((a, b) => a.at - b.at);
  for (let i = 0; i < sched.length; i++) {
    assert.ok(R.EVENT_DEFS[sched[i].id], sched[i].id);
    assert.ok(sched[i].at + sched[i].dur <= 1);
    if (i > 0) assert.ok(sched[i].at >= sched[i - 1].at + sched[i - 1].dur);
  }
  assert.deepEqual([...new Set(sched.map((e) => e.id))].sort(), ['bloodMoon', 'fog', 'rain']);
});

test('activeEvent: inside a window only, with its multipliers', () => {
  const first = R.EVENT_SCHEDULE[0];
  assert.equal(R.activeEvent(first.at - 0.001), null);
  const ev = R.activeEvent(first.at + first.dur / 2);
  assert.equal(ev.id, first.id);
  assert.ok(ev.spawnMult >= 1 && ev.xpMult >= 1 && ev.speedMult > 0);
  assert.ok(Math.abs(ev.endsAt - (first.at + first.dur)) < 1e-9);
  assert.equal(R.activeEvent(first.at + first.dur), null);
  assert.equal(R.activeEvent(0), null);
});

test('blood moon: most monsters and double experience', () => {
  const moon = R.EVENT_DEFS.bloodMoon;
  for (const d of Object.values(R.EVENT_DEFS)) assert.ok(moon.spawnMult >= d.spawnMult && moon.xpMult >= d.xpMult);
  assert.equal(moon.xpMult, 2);
});

test('new monsters: spitter shoots, exploder blows up, healer heals', () => {
  const E = R.CONFIG.enemies;
  assert.ok(E.spitter.ranged.range > 0 && E.spitter.ranged.damage > 0 && E.spitter.keep > 0);
  assert.ok(E.exploder.explodes.radius > E.exploder.radius && E.exploder.explodes.damage > 0);
  assert.ok(E.healer.heals.radius > 0 && E.healer.heals.amount > 0 && E.healer.keep > E.spitter.keep);
  assert.ok(E.exploder.speed > E.walker.speed);
  for (const t of ['spitter', 'exploder', 'healer']) assert.ok(!E[t].boss && E[t].size >= 2 * E[t].radius, t);
});

test('capsule config', () => {
  const c = R.CONFIG.capsule;
  assert.ok(c.duration > 0 && c.radius > 0 && c.push > 0);
});

function fakeKeys() {
  const target = new EventTarget();
  const keys = new R.HeldKeys(target);
  const press = (code) => target.dispatchEvent(Object.assign(new Event('keydown'), { code }));
  const release = (code) => target.dispatchEvent(Object.assign(new Event('keyup'), { code }));
  return { target, keys, press, release };
}

test('HeldKeys: a held key stays held until it is released', () => {
  const { keys, press, release } = fakeKeys();
  assert.deepEqual(keys.move(), { x: 0, y: 0 });
  press('KeyW');
  press('KeyW'); // auto-repeat
  assert.deepEqual(keys.move(), { x: 0, y: -1 });
  release('KeyW');
  assert.deepEqual(keys.move(), { x: 0, y: 0 });
});

test('HeldKeys: WASD and arrows, opposite keys cancel out', () => {
  const { keys, press, release } = fakeKeys();
  press('KeyD');
  press('KeyS');
  assert.deepEqual(keys.move(), { x: 1, y: 1 });
  press('KeyA');
  assert.deepEqual(keys.move(), { x: 0, y: 1 });
  release('KeyA');
  release('KeyD');
  release('KeyS');
  press('ArrowLeft');
  press('ArrowUp');
  assert.deepEqual(keys.move(), { x: -1, y: -1 });
});

test('HeldKeys: physical key codes, so another keyboard layout works', () => {
  const { keys, press } = fakeKeys();
  press('KeyW'); // the same physical key is "ц" on a Russian layout; code stays KeyW
  assert.equal(keys.move().y, -1);
  assert.equal(keys.has('KeyW'), true);
  assert.equal(keys.has('KeyQ'), false);
});

test('HeldKeys: losing window focus releases every key', () => {
  const { keys, target, press } = fakeKeys();
  press('KeyW');
  press('KeyD');
  target.dispatchEvent(new Event('blur'));
  assert.deepEqual(keys.move(), { x: 0, y: 0 });
});

test('drone config: one drone at the start, weaker than the player', () => {
  const D = R.CONFIG.drone;
  assert.equal(R.CONFIG.player.drones, 1);
  assert.ok(D.range > 0 && D.interval > 0 && D.speed > 0 && D.life > 0 && D.orbitRadius > 0);
  assert.ok(D.damageMul > 0 && D.damageMul < 1);
});

test('drone upgrade: +1 drone, up to 3 in total', () => {
  const up = R.UPGRADES.find((u) => u.id === 'drone');
  assert.ok(up && up.name && up.desc);
  const st = { ...R.CONFIG.player };
  for (let i = 0; i < up.max; i++) up.apply(st);
  assert.equal(st.drones, 1 + up.max);
  assert.equal(1 + up.max, 3);
});

test('droneSlot: drones sit evenly on a circle around the player and circle over time', () => {
  const r = 64;
  for (const n of [1, 2, 3]) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const o = R.droneSlot(i, n, 0, r, 1.4);
      assert.ok(Math.abs(Math.hypot(o.x, o.y) - r) < 1e-9);
      pts.push(o);
    }
    if (n === 2) assert.ok(Math.abs(pts[0].x + pts[1].x) < 1e-9 && Math.abs(pts[0].y + pts[1].y) < 1e-9);
  }
  const a = R.droneSlot(0, 1, 0, r, 1.4);
  const b = R.droneSlot(0, 1, 1, r, 1.4);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1);
  assert.ok(Math.abs(Math.hypot(b.x, b.y) - r) < 1e-9);
});

test('nearestTarget: closest active enemy in range, otherwise null', () => {
  const list = [
    { x: 300, y: 0, active: true },
    { x: 100, y: 0, active: false },
    { x: 150, y: 0, active: true },
    { x: 900, y: 0, active: true },
  ];
  assert.equal(R.nearestTarget(0, 0, list, 420), list[2]);
  assert.equal(R.nearestTarget(0, 0, list, 100), null);
  assert.equal(R.nearestTarget(0, 0, [], 420), null);
  assert.equal(R.nearestTarget(850, 0, list, 100), list[3]);
});

test('boss skills: every boss has a kit, each skill is complete', () => {
  assert.deepEqual(Object.keys(R.BOSS_SKILLS).sort(), ['boss', 'colossus', 'wraith']);
  const known = ['charge', 'slam', 'rocks', 'blink', 'summon'];
  for (const [type, skills] of Object.entries(R.BOSS_SKILLS)) {
    assert.ok(R.CONFIG.enemies[type].boss, type);
    assert.ok(skills.length >= 1, type);
    for (const sk of skills) {
      assert.ok(known.includes(sk.id), sk.id);
      assert.ok(sk.label && sk.cooldown > sk.windup && sk.windup >= 400, sk.id);
    }
  }
  const ids = (t) => R.BOSS_SKILLS[t].map((k) => k.id).sort();
  assert.deepEqual(ids('boss'), ['charge', 'slam']);
  assert.deepEqual(ids('colossus'), ['rocks']);
  assert.deepEqual(ids('wraith'), ['blink', 'summon']);
});

test('boss skills: the summoned ghosts exist and are weak, never part of normal spawns', () => {
  const sm = R.BOSS_SKILLS.wraith.find((k) => k.id === 'summon');
  const ghost = R.CONFIG.enemies.ghost;
  assert.ok(ghost && !ghost.boss && ghost.hp < R.CONFIG.enemies.walker.hp);
  assert.ok(sm.count >= 2 && sm.max >= sm.count);
  for (const st of R.SPAWN_STAGES) assert.ok(!st.weights.some((w) => w[0] === 'ghost'));
});

test('chooseBossSkill: only skills off cooldown, prefers a different one than last time', () => {
  const skills = R.BOSS_SKILLS.boss; // charge, slam
  assert.equal(R.chooseBossSkill(skills, { charge: 5000, slam: 5000 }, 1000, null, () => 0), null);
  assert.equal(R.chooseBossSkill(skills, { charge: 0, slam: 5000 }, 1000, null, () => 0.99).id, 'charge');
  assert.equal(R.chooseBossSkill(skills, {}, 1000, 'charge', () => 0).id, 'slam');
  assert.equal(R.chooseBossSkill(skills, {}, 1000, 'slam', () => 0.99).id, 'charge');
  // only the repeated skill is ready: it is used again rather than nothing
  assert.equal(R.chooseBossSkill(skills, { slam: 9000 }, 1000, 'charge', () => 0).id, 'charge');
  assert.equal(R.chooseBossSkill(skills, {}, 1000, null, () => 0).id, 'charge');
  assert.equal(R.chooseBossSkill(skills, {}, 1000, null, () => 0.99).id, 'slam');
});

test('boss AI timings', () => {
  const ai = R.BOSS_AI;
  assert.ok(ai.firstDelay > 0 && ai.recover > 0 && ai.gap[0] > 0 && ai.gap[1] >= ai.gap[0]);
});

test('Q ability: fire ring config', () => {
  const a = R.CONFIG.ability;
  assert.ok(a.cooldown > a.duration && a.radius > R.CONFIG.capsule.radius && a.damageMul > 1);
  assert.ok(a.knock > 0 && a.burnMs > 0 && a.burnFrac > 0 && a.burnFrac < 1);
  assert.ok(a.cooldown > R.CONFIG.player.dashCooldown);
});

test('release: version is semver and equals package.json', () => {
  assert.match(R.VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(R.VERSION, require('../package.json').version);
});

const fs = require('node:fs');
const path = require('node:path');

test('i18n: Russian-speaking countries get Russian, everyone else English', () => {
  for (const c of ['ru', 'ru-RU', 'be', 'kk', 'uk', 'uz', 'RU']) assert.equal(R.langFor(c), 'ru', c);
  for (const c of ['en', 'en-US', 'tr', 'de', 'zh', '', null, undefined]) assert.equal(R.langFor(c), 'en', String(c));
});

test('i18n: detectLang prefers ?lang=, then the browser language, then Russian', () => {
  assert.equal(R.detectLang('?lang=en', 'ru-RU'), 'en');
  assert.equal(R.detectLang('?x=1&lang=ru', 'en-US'), 'ru');
  assert.equal(R.detectLang('', 'en-GB'), 'en');
  assert.equal(R.detectLang('', 'ru'), 'ru');
  assert.equal(R.detectLang('', ''), 'ru');
});

test('i18n: t and tt pick the text of the current language', () => {
  const was = R.lang;
  R.setLang('ru');
  assert.equal(R.t('да', 'yes'), 'да');
  assert.equal(R.tt(['да', 'yes']), 'да');
  assert.equal(R.tt('plain'), 'plain');
  R.setLang('tr'); // anything that is not Russian-speaking
  assert.equal(R.lang, 'en');
  assert.equal(R.t('да', 'yes'), 'yes');
  assert.equal(R.tt(['да', 'yes']), 'yes');
  R.setLang(was);
});

test('i18n: every text that comes as data has Russian and English', () => {
  const pair = (v, where) => {
    assert.ok(Array.isArray(v) && v.length === 2, where + ' must be [ru, en]');
    assert.ok(/[А-Яа-я]/.test(v[0]) && /[A-Za-z]/.test(v[1]) && !/[А-Яа-я]/.test(v[1]), where + ' ' + JSON.stringify(v));
  };
  for (const u of R.UPGRADES) { pair(u.name, 'upgrade ' + u.id + ' name'); pair(u.desc, 'upgrade ' + u.id + ' desc'); }
  for (const it of R.SHOP_ITEMS) { pair(it.name, 'shop ' + it.id + ' name'); pair(it.desc, 'shop ' + it.id + ' desc'); }
  for (const w of Object.values(R.WEAPONS)) pair(w.name, 'weapon ' + w.id);
  for (const e of Object.values(R.EVENT_DEFS)) { pair(e.name, 'event ' + e.id + ' name'); pair(e.note, 'event ' + e.id + ' note'); }
  for (const [boss, skills] of Object.entries(R.BOSS_SKILLS)) for (const sk of skills) pair(sk.label, 'skill ' + sk.id);
  for (const type of ['boss', 'colossus', 'wraith']) pair(R.CONFIG.enemies[type].name, 'boss ' + type);
});

test('i18n: shop "now" texts exist in both languages', () => {
  const was = R.lang;
  for (const lang of ['ru', 'en']) {
    R.setLang(lang);
    for (const it of R.SHOP_ITEMS) {
      const text = it.now(2);
      assert.ok(text.length > 0, it.id);
      assert.equal(/[А-Яа-я]/.test(text), lang === 'ru' && it.id !== 'maxHp', it.id + ' ' + lang + ' ' + text);
    }
  }
  R.setLang(was);
});

test('i18n: no Russian text is left in the code outside t() / tt() pairs', () => {
  const files = [];
  const walk = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (p.endsWith('.js')) files.push(p);
    }
  };
  walk(path.join(__dirname, '..', 'src'));
  const pairRe = /\[\s*'[^']*[А-Яа-я][^']*'\s*,\s*'[^'А-Яа-я]*[A-Za-z][^'А-Яа-я]*'\s*\]/;
  const tCallRe = /\bR\.tt?\(/;
  const offenders = [];
  for (const file of files) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (!/[А-Яа-я]/.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
      const code = line.replace(/\/\/.*$/, ''); // a trailing comment may be Russian
      if (!/[А-Яа-я]/.test(code)) return;
      // every Russian string literal must sit inside R.t(...) or a [ru, en] pair
      const literals = code.match(/'[^']*[А-Яа-я][^']*'/g) || [];
      const covered = pairRe.test(code) || tCallRe.test(code);
      if (literals.length && !covered) offenders.push(path.relative(path.join(__dirname, '..'), file) + ':' + (i + 1) + ': ' + line.trim());
    });
  }
  assert.deepEqual(offenders, []);
});

test('storage: memory fallback, swappable backend, values are strings', () => {
  R.storage.clearMemory();
  assert.equal(R.storage.getItem('a'), null);
  R.storage.setItem('a', 5);
  assert.equal(R.storage.getItem('a'), '5');
  R.storage.removeItem('a');
  assert.equal(R.storage.getItem('a'), null);
  const store = {};
  const backend = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
  R.storage.useBackend(backend);
  R.storage.setItem('b', 'x');
  assert.equal(store.b, 'x');
  assert.equal(R.storage.getItem('b'), 'x');
  R.storage.useBackend({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } });
  R.storage.setItem('c', 'y'); // a broken backend must not crash the game
  assert.equal(R.storage.getItem('c'), 'y');
  R.storage.useBackend(null);
  R.storage.clearMemory();
});

function fakeYsdk() {
  const calls = [];
  const handlers = {};
  const store = {};
  return {
    calls,
    handlers,
    store,
    environment: { i18n: { lang: 'tr' } },
    on: (name, fn) => (handlers[name] = fn),
    getStorage: () => Promise.resolve({ getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] }),
    features: { LoadingAPI: { ready: () => calls.push('ready') }, GameplayAPI: { start: () => calls.push('start'), stop: () => calls.push('stop') } },
    adv: {
      // like the real SDK: calls only the callbacks the game gave
      showFullscreenAdv: (o) => { calls.push('interstitial'); if (o.callbacks.onOpen) o.callbacks.onOpen(); o.callbacks.onClose(true); },
      showRewardedVideo: (o) => { calls.push('rewarded'); if (o.callbacks.onOpen) o.callbacks.onOpen(); o.callbacks.onRewarded(); o.callbacks.onClose(true); },
    },
  };
}

test('platform without SDK: no-ops, ads are skipped, the callback still runs', async () => {
  const pf = new R.Platform();
  assert.equal(pf.name, 'none');
  assert.equal(pf.hasAds, false);
  await pf.init(); // there is no YaGames in Node
  pf.loadingReady();
  pf.gameplayStart();
  pf.gameplayStop();
  let done = 0;
  pf.showInterstitial(() => done++);
  assert.equal(done, 1);
  let rewarded = 0;
  pf.showRewarded(() => rewarded++, () => done++);
  assert.equal(rewarded, 0, 'no reward without a video');
  assert.equal(done, 2);
});

test('platform with the Yandex SDK: language, storage, events, ads', async () => {
  const was = R.lang;
  const ysdk = fakeYsdk();
  const pf = new R.Platform();
  await pf.attach(ysdk);
  assert.equal(pf.name, 'yandex');
  assert.equal(pf.hasAds, true);
  assert.equal(R.lang, 'en'); // 'tr' is not Russian-speaking
  R.storage.setItem('k', 'v');
  assert.equal(ysdk.store.k, 'v', 'saves go to the safe storage of the platform');
  pf.loadingReady();
  pf.gameplayStart();
  pf.gameplayStop();
  assert.deepEqual(ysdk.calls, ['ready', 'start', 'stop']);
  let paused = 0;
  let resumed = 0;
  pf.onPause = () => paused++;
  pf.onResume = () => resumed++;
  ysdk.handlers.game_api_pause();
  ysdk.handlers.game_api_resume();
  assert.deepEqual([paused, resumed], [1, 1]);
  let closed = 0;
  pf.showInterstitial(() => closed++);
  assert.equal(closed, 1, 'the callback runs exactly once');
  assert.ok(ysdk.calls.includes('interstitial'), 'the ad was really requested');
  let reward = 0;
  let after = 0;
  pf.showRewarded(() => reward++, () => after++);
  assert.deepEqual([reward, after], [1, 1]);
  assert.ok(ysdk.calls.includes('rewarded'), 'the video was really requested');
  R.storage.useBackend(null);
  R.storage.clearMemory();
  R.setLang(was);
});

test('platform: an ad that errors out never blocks the game', () => {
  const ysdk = fakeYsdk();
  ysdk.adv.showFullscreenAdv = (o) => { o.callbacks.onError(new Error('x')); o.callbacks.onClose(false); };
  ysdk.adv.showRewardedVideo = (o) => { o.callbacks.onError(new Error('x')); };
  const pf = new R.Platform();
  pf.ysdk = ysdk;
  pf.hasAds = true;
  let a = 0;
  pf.showInterstitial(() => a++);
  assert.equal(a, 1, 'once, although both onError and onClose fired');
  let reward = 0;
  let b = 0;
  pf.showRewarded(() => reward++, () => b++);
  assert.deepEqual([reward, b], [0, 1]);
});

Promise.all(pending).then(() => {
  console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
});
