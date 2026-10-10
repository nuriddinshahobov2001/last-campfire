(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Which keys are physically held, tracked straight from DOM events.
  // Phaser resets its own key state whenever a scene is paused (level-up menu, pause), so a
  // movement key the player keeps holding would stop working until pressed again.
  // Uses `event.code` (the physical key), so any keyboard layout works.
  R.HeldKeys = class HeldKeys {
    constructor(target) {
      this.down = new Set();
      target.addEventListener('keydown', (e) => this.down.add(e.code));
      target.addEventListener('keyup', (e) => this.down.delete(e.code));
      target.addEventListener('blur', () => this.down.clear()); // key-up events are lost when focus leaves
    }

    has(code) {
      return this.down.has(code);
    }

    // Movement direction from WASD or the arrows: x and y are each -1, 0 or 1 (not normalised).
    move() {
      const d = this.down;
      return {
        x: (d.has('KeyD') || d.has('ArrowRight') ? 1 : 0) - (d.has('KeyA') || d.has('ArrowLeft') ? 1 : 0),
        y: (d.has('KeyS') || d.has('ArrowDown') ? 1 : 0) - (d.has('KeyW') || d.has('ArrowUp') ? 1 : 0),
      };
    }
  };

  // The one instance the game uses (in Node, e.g. in tests, there is no window).
  R.held = typeof window !== 'undefined' ? new R.HeldKeys(window) : null;
})();
