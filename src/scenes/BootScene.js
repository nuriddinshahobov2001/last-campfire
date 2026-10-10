(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  R.BootScene = class BootScene extends Phaser.Scene {
    constructor() {
      super('BootScene');
    }

    create() {
      R.makeTextures(this);
      this.scene.start('MenuScene');
    }
  };
})();
