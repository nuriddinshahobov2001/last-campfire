(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // The look of the night events: fog that hides everything but your surroundings,
  // a blood-red tint, rain with lightning. Gameplay effects come from R.activeEvent().
  R.EventFx = class EventFx {
    constructor(scene) {
      const C = R.CONFIG;
      this.scene = scene;
      this.currentId = null;
      this.nextFlash = 0;

      this.fog = scene.add.image(C.WIDTH / 2, C.HEIGHT / 2, 'fogvision').setScrollFactor(0).setDepth(53).setAlpha(0);
      this.blood = scene.add
        .rectangle(0, 0, C.WIDTH, C.HEIGHT, 0x9a0a0a, 1)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(53)
        .setAlpha(0);
      this.rain = scene.add
        .particles(0, 0, 'raindrop', {
          x: { min: -100, max: C.WIDTH + 100 },
          y: -30,
          lifespan: 900,
          speedY: { min: 820, max: 1000 },
          speedX: -160,
          rotate: 10,
          scale: { min: 0.7, max: 1.2 },
          alpha: { start: 0.6, end: 0.2 },
          frequency: 6,
          quantity: 3,
          emitting: false,
        })
        .setScrollFactor(0)
        .setDepth(54);
    }

    // ev: an R.activeEvent() result, or null when the night is calm.
    set(ev) {
      const id = ev ? ev.id : null;
      if (id === this.currentId) return;
      this.currentId = id;
      const s = this.scene;
      const fade = (obj, alpha) => s.tweens.add({ targets: obj, alpha, duration: 1500 });
      fade(this.fog, id === 'fog' ? 1 : 0);
      fade(this.blood, id === 'bloodMoon' ? 0.22 : 0);
      if (id === 'rain') {
        this.rain.start();
        this.nextFlash = s.elapsed * 1000 + 2500;
      } else {
        this.rain.stop();
      }
      if (ev) s.events.emit('banner', R.tt(ev.name).toUpperCase() + '\n' + R.tt(ev.note), ev.color);
    }

    update(nowMs) {
      if (this.currentId !== 'rain' || nowMs < this.nextFlash) return;
      this.scene.cameras.main.flash(140, 210, 225, 255);
      this.nextFlash = nowMs + 5000 + Math.random() * 7000;
    }
  };
})();
