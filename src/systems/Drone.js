(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Where drone number `index` of `count` hovers, relative to the player, at time tSec:
  // evenly spaced on a circle that slowly turns.
  R.droneSlot = function (index, count, tSec, radius, spin) {
    const a = spin * tSec + (index * Math.PI * 2) / count;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  };

  // The closest item with `active` set within `range` of (x, y), or null.
  R.nearestTarget = function (x, y, list, range) {
    let best = null;
    let bestD = range * range;
    for (const item of list) {
      if (!item.active) continue;
      const dx = item.x - x;
      const dy = item.y - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  };
})();
