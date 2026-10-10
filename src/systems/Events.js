(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Night events: spawnMult = more monsters, xpMult = more experience from kills,
  // speedMult = monster speed. Windows are fractions of the night, so ?debug scales them too.
  R.EVENT_DEFS = {
    fog: { id: 'fog', name: ['Туман', 'Fog'], spawnMult: 1.3, xpMult: 1.3, speedMult: 1, color: '#cfe0e8', note: ['монстров больше, опыта больше, ничего не видно', 'more monsters, more experience, you can barely see'] },
    rain: { id: 'rain', name: ['Ливень', 'Downpour'], spawnMult: 1.2, xpMult: 1.25, speedMult: 1.1, color: '#8fc4ff', note: ['монстры быстрее, опыта больше', 'monsters are faster, more experience'] },
    bloodMoon: { id: 'bloodMoon', name: ['Кровавая луна', 'Blood Moon'], spawnMult: 1.5, xpMult: 2, speedMult: 1, color: '#ff6a5a', note: ['монстров больше, опыта вдвое', 'more monsters, double experience'] },
  };

  R.EVENT_SCHEDULE = [
    { id: 'fog', at: 0.1, dur: 0.1 },
    { id: 'bloodMoon', at: 0.3, dur: 0.1 },
    { id: 'rain', at: 0.55, dur: 0.1 },
    { id: 'bloodMoon', at: 0.78, dur: 0.08 },
  ];

  // The event running at fraction f of the night (with endsAt as a fraction), or null.
  R.activeEvent = function (f) {
    for (const w of R.EVENT_SCHEDULE) {
      if (f >= w.at && f < w.at + w.dur) return Object.assign({}, R.EVENT_DEFS[w.id], { endsAt: w.at + w.dur });
    }
    return null;
  };
})();
