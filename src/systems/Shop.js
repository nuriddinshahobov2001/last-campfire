(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Permanent upgrades bought with diamonds between runs.
  // costs[i] is the price of level i + 1; apply(stats, level) adds the total bonus of `level`.
  R.SHOP_ITEMS = [
    {
      id: 'maxHp',
      name: ['Здоровье', 'Health'],
      desc: ['+10 макс. HP за уровень', '+10 max HP per level'],
      max: 5,
      costs: [3, 5, 8, 12, 17],
      now: (l) => '+' + 10 * l + ' HP',
      apply(s, l) {
        s.maxHp += 10 * l;
        s.hp = s.maxHp;
      },
    },
    {
      id: 'damage',
      name: ['Урон', 'Damage'],
      desc: ['+5% урона пули за уровень', '+5% bullet damage per level'],
      max: 5,
      costs: [3, 5, 8, 12, 17],
      now: (l) => R.t('+' + 5 * l + '% урона', '+' + 5 * l + '% damage'),
      apply(s, l) {
        s.damage *= 1 + 0.05 * l;
      },
    },
    {
      id: 'fireRate',
      name: ['Скорострельность', 'Fire rate'],
      desc: ['+5% выстрелов в секунду за уровень', '+5% shots per second per level'],
      max: 5,
      costs: [4, 6, 9, 13, 18],
      now: (l) => R.t('+' + 5 * l + '% скорости огня', '+' + 5 * l + '% fire rate'),
      apply(s, l) {
        s.fireRate *= 1 + 0.05 * l;
      },
    },
    {
      id: 'speed',
      name: ['Скорость бега', 'Move speed'],
      desc: ['+3% скорости за уровень', '+3% speed per level'],
      max: 5,
      costs: [3, 4, 6, 9, 13],
      now: (l) => R.t('+' + 3 * l + '% скорости', '+' + 3 * l + '% speed'),
      apply(s, l) {
        s.speed *= 1 + 0.03 * l;
      },
    },
    {
      id: 'dashCd',
      name: ['Рывок', 'Dash'],
      desc: ['−10% перезарядки рывка за уровень', '−10% dash cooldown per level'],
      max: 5,
      costs: [3, 4, 6, 9, 13],
      now: (l) => R.t('−' + 10 * l + '% перезарядки', '−' + 10 * l + '% cooldown'),
      apply(s, l) {
        s.dashCooldown *= 1 - 0.1 * l;
      },
    },
    {
      id: 'pickup',
      name: ['Сбор добычи', 'Loot pickup'],
      desc: ['+15% радиуса подбора за уровень', '+15% pickup radius per level'],
      max: 3,
      costs: [3, 6, 10],
      now: (l) => R.t('+' + 15 * l + '% радиуса', '+' + 15 * l + '% radius'),
      apply(s, l) {
        s.pickupRadius *= 1 + 0.15 * l;
      },
    },
  ];

  // Price of the next level, or null when the item is maxed.
  R.shopCost = function (item, level) {
    return level >= item.max ? null : item.costs[level];
  };

  // Adds every bought bonus to a fresh stats object.
  R.applyShop = function (stats, levels) {
    for (const item of R.SHOP_ITEMS) {
      const level = (levels && levels[item.id]) || 0;
      if (level > 0) item.apply(stats, level);
    }
  };

  // state = { bank, levels }. Returns { ok, reason?, cost?, state }; never mutates `state`.
  R.buyUpgrade = function (state, id) {
    const item = R.SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return { ok: false, reason: 'unknown', state };
    const level = state.levels[id] || 0;
    const cost = R.shopCost(item, level);
    if (cost === null) return { ok: false, reason: 'max', state };
    if (state.bank < cost) return { ok: false, reason: 'poor', state };
    return {
      ok: true,
      cost,
      state: { bank: state.bank - cost, levels: Object.assign({}, state.levels, { [id]: level + 1 }) },
    };
  };

  // ---- storage (R.storage, never throws) ----------------------------------

  const SHOP_KEY = 'rassvet.shop';

  R.loadShop = function () {
    const empty = { bank: 0, levels: {} };
    try {
      const raw = JSON.parse(R.storage.getItem(SHOP_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return empty;
      const bank = Number.isFinite(raw.bank) && raw.bank > 0 ? Math.floor(raw.bank) : 0;
      const levels = {};
      for (const item of R.SHOP_ITEMS) {
        const l = Number(raw.levels && raw.levels[item.id]);
        if (Number.isFinite(l) && l > 0) levels[item.id] = Math.min(item.max, Math.floor(l));
      }
      return { bank, levels };
    } catch (e) {
      return empty;
    }
  };

  R.saveShop = function (state) {
    try {
      R.storage.setItem(SHOP_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable: play without saving */
    }
  };

  R.addToBank = function (count) {
    const state = R.loadShop();
    state.bank += Math.max(0, Math.floor(count));
    R.saveShop(state);
    return state;
  };
})();
