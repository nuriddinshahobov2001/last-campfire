(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // State of the dash at time nowMs, for a dash that started at startedAt (ms).
  // The cooldown counts from the start of the dash. While active the player is invulnerable.
  R.dashStatus = function (nowMs, startedAt, duration, cooldown) {
    const since = nowMs - startedAt;
    const ready = since >= cooldown;
    return {
      active: since >= 0 && since < duration,
      ready,
      cooldownLeft: Math.max(0, cooldown - since),
      cooldownFrac: ready ? 1 : Math.max(0, since / cooldown),
    };
  };
})();
