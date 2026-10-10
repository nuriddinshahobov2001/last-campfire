(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  const MARGIN = 60; // keep crates this far from the world edge
  const MIN_GAP = 140; // minimum distance between two crates

  // Loot from a broken crate: 26% heal, 26% experience crystals, 12% magnet,
  // 24% a weapon, 12% a protective capsule.
  R.rollCrateLoot = function (rng) {
    const r = (rng || Math.random)();
    if (r < 0.26) return 'heal';
    if (r < 0.52) return 'xp';
    if (r < 0.64) return 'magnet';
    if (r < 0.88) return 'weapon';
    return 'capsule';
  };

  // Which weapon a crate holds (see R.PICKUP_WEAPONS).
  R.rollWeapon = function (rng) {
    const list = R.PICKUP_WEAPONS;
    return list[Math.min(list.length - 1, Math.floor((rng || Math.random)() * list.length))];
  };

  // existing: [{x, y}] crates already placed; avoid: [{x, y, r}] zones to stay out of.
  // Returns {x, y}, or null when no free spot was found.
  R.pickCrateSpot = function (existing, avoid, rng) {
    rng = rng || Math.random;
    const C = R.CONFIG;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = MARGIN + rng() * (C.WORLD_W - 2 * MARGIN);
      const y = MARGIN + rng() * (C.WORLD_H - 2 * MARGIN);
      const blocked =
        avoid.some((a) => Math.hypot(x - a.x, y - a.y) < a.r) ||
        existing.some((e) => Math.hypot(x - e.x, y - e.y) < MIN_GAP);
      if (!blocked) return { x, y };
    }
    return null;
  };
})();
