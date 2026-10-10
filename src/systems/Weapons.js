(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Picked-up weapons last this long, then the player is back to the pistol.
  R.WEAPON_DURATION_MS = 25000;

  // Projectile textures: size of the image and the radius of its round hitbox.
  R.BULLET_TEX = {
    bullet: { w: 16, h: 16, r: 4 },
    laser: { w: 44, h: 10, r: 5 },
    rocket: { w: 28, h: 14, r: 6 },
  };

  // damageMul / rateMul scale the player's damage / fire rate. speed and life (ms) null = player's own.
  // pellets: bullets per shot; spread: degrees between neighbouring bullets.
  // pierce 99 = goes through everything. explosion: blows up on impact, damage to all in radius.
  R.WEAPONS = {
    pistol: { id: 'pistol', name: ['Пистолет', 'Pistol'], damageMul: 1, rateMul: 1, speed: null, life: null, pellets: 1, spread: 12, pierce: 0, tex: 'bullet', blend: 'ADD' },
    shotgun: { id: 'shotgun', name: ['Дробовик', 'Shotgun'], damageMul: 0.6, rateMul: 0.45, speed: 700, life: 380, pellets: 7, spread: 7, pierce: 0, tex: 'bullet', blend: 'ADD' },
    laser: { id: 'laser', name: ['Лазер', 'Laser'], damageMul: 0.7, rateMul: 0.9, speed: 1500, life: 700, pellets: 1, spread: 10, pierce: 99, tex: 'laser', blend: 'ADD' },
    rocket: { id: 'rocket', name: ['Ракетница', 'Rocket launcher'], damageMul: 2.2, rateMul: 0.4, speed: 420, life: 1400, pellets: 1, spread: 10, pierce: 0, tex: 'rocket', blend: 'NORMAL', explosion: { radius: 95 } },
  };

  // Which weapons crates can drop.
  R.PICKUP_WEAPONS = ['shotgun', 'laser', 'rocket'];

  // Everything one shot needs: the angle offsets of its bullets (rad) and their stats.
  R.weaponVolley = function (weapon, stats) {
    const pellets = weapon.pellets + Math.max(0, stats.shots - 1);
    const step = (weapon.spread * Math.PI) / 180;
    const angles = [];
    for (let i = 0; i < pellets; i++) angles.push((i - (pellets - 1) / 2) * step);
    return {
      angles,
      damage: stats.damage * weapon.damageMul,
      interval: 1000 / (stats.fireRate * weapon.rateMul),
      pierce: Math.min(99, weapon.pierce + stats.pierce),
      speed: weapon.speed || stats.bulletSpeed,
      life: weapon.life || stats.bulletLife,
    };
  };
})();
