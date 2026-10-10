(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  R.UPGRADES = [
    {
      id: 'fireRate',
      name: ['Скорострельность', 'Fire rate'],
      desc: ['+20% выстрелов в секунду', '+20% shots per second'],
      max: 5,
      apply(s) {
        s.fireRate *= 1.2;
      },
    },
    {
      id: 'damage',
      name: ['Урон', 'Damage'],
      desc: ['+25% урона пули', '+25% bullet damage'],
      max: 5,
      apply(s) {
        s.damage *= 1.25;
      },
    },
    {
      id: 'speed',
      name: ['Скорость', 'Speed'],
      desc: ['+10% скорости бега', '+10% move speed'],
      max: 4,
      apply(s) {
        s.speed *= 1.1;
      },
    },
    {
      id: 'maxHp',
      name: ['Здоровье', 'Health'],
      desc: ['+25 макс. HP и лечение на 25', '+25 max HP and heal 25'],
      max: 4,
      apply(s) {
        s.maxHp += 25;
        s.hp = Math.min(s.maxHp, s.hp + 25);
      },
    },
    {
      id: 'multishot',
      name: ['Двойной выстрел', 'Double shot'],
      desc: ['+1 пуля за выстрел', '+1 bullet per shot'],
      max: 3,
      apply(s) {
        s.shots += 1;
      },
    },
    {
      id: 'drone',
      name: ['Дрон-помощник', 'Drone helper'],
      desc: ['+1 летающий помощник, стреляет сам', '+1 flying helper that shoots by itself'],
      max: 2,
      apply(s) {
        s.drones += 1;
      },
    },
    {
      id: 'pierce',
      name: ['Пробивание', 'Piercing'],
      desc: ['Пуля пробивает +1 цель', 'Bullets pierce +1 target'],
      max: 3,
      apply(s) {
        s.pierce += 1;
      },
    },
  ];

  R.xpForLevel = function (level) {
    return 4 + 2 * (level - 1);
  };

  R.pickThree = function (levels, rng) {
    rng = rng || Math.random;
    const pool = R.UPGRADES.filter((u) => (levels[u.id] || 0) < u.max);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, 3);
  };
})();
