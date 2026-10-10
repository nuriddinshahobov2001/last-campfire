(function () {
  const R = globalThis.Rassvet;

  // Holding / right-clicking the mouse must never open the browser menu or start a drag.
  for (const type of ['contextmenu', 'dragstart', 'selectstart']) {
    document.addEventListener(type, (e) => e.preventDefault());
  }

  const boot = document.getElementById('boot'); // the "loading" text of index.html

  function start() {
    document.title = R.t('Рассвет', 'Dawn');
    R.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: R.CONFIG.WIDTH,
      height: R.CONFIG.HEIGHT,
      parent: 'game',
      backgroundColor: '#0a0f1f',
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      scene: [R.BootScene, R.MenuScene, R.GameScene, R.UIScene, R.EndScene, R.ShopScene],
    });
    if (boot) boot.remove();
  }

  // Wait for the portal SDK (language, saves) if there is one; never wait longer than 6 seconds.
  let started = false;
  const once = () => {
    if (started) return;
    started = true;
    start();
  };
  R.platform.init().then(once, once);
  setTimeout(once, 6000);
})();
