(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // The game's link to the portal it runs on. Without a portal SDK (itch.io, a local file) every
  // call is a harmless no-op and ads are skipped. With the Yandex Games SDK (/sdk.js is added by
  // `node tools/build.js --target yandex`) it takes over language, saves, ads and pause events.
  R.Platform = class Platform {
    constructor() {
      this.name = 'none';
      this.ysdk = null;
      this.hasAds = false;
      this.onPause = null; // set by the game: the portal wants the game paused (ad, other tab)
      this.onResume = null;
      this.loadingReported = false;
    }

    // Called once before the game is created. Always resolves, also when the SDK is missing or fails.
    init() {
      if (typeof YaGames === 'undefined') return Promise.resolve();
      return YaGames.init()
        .then((ysdk) => this.attach(ysdk))
        .catch(() => {});
    }

    attach(ysdk) {
      this.ysdk = ysdk;
      this.name = 'yandex';
      this.hasAds = !!(ysdk.adv && ysdk.adv.showFullscreenAdv);
      try {
        R.setLang(ysdk.environment.i18n.lang);
      } catch (e) {
        /* keep the language we detected */
      }
      if (typeof ysdk.on === 'function') {
        ysdk.on('game_api_pause', () => this.onPause && this.onPause());
        ysdk.on('game_api_resume', () => this.onResume && this.onResume());
      }
      return Promise.resolve()
        .then(() => (ysdk.getStorage ? ysdk.getStorage() : null))
        .then((safeStorage) => {
          if (safeStorage) R.storage.useBackend(safeStorage);
        })
        .catch(() => {});
    }

    // The game is loaded and the menu can be used.
    loadingReady() {
      if (this.loadingReported) return;
      this.loadingReported = true;
      const api = this.ysdk && this.ysdk.features && this.ysdk.features.LoadingAPI;
      if (api && api.ready) api.ready();
    }

    // Tells the portal when real play is going on (not in menus, not paused, not behind an ad).
    gameplayStart() {
      const api = this.ysdk && this.ysdk.features && this.ysdk.features.GameplayAPI;
      if (api && api.start) api.start();
    }

    gameplayStop() {
      const api = this.ysdk && this.ysdk.features && this.ysdk.features.GameplayAPI;
      if (api && api.stop) api.stop();
    }

    // A full-screen ad between two runs. `done` is called exactly once, whatever happens.
    showInterstitial(done) {
      let finished = false;
      let timer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        done();
      };
      if (!this.hasAds) {
        finish();
        return;
      }
      timer = setTimeout(finish, 20000); // never leave the player stuck behind a broken ad
      try {
        this.ysdk.adv.showFullscreenAdv({ callbacks: { onClose: finish, onError: finish } });
      } catch (e) {
        finish();
      }
    }

    // A video the player chose to watch. onRewarded runs only if the video counted; done runs
    // exactly once at the end (also without ads or on an error).
    showRewarded(onRewarded, done) {
      let finished = false;
      let rewarded = false;
      let timer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        done();
      };
      if (!this.hasAds) {
        finish();
        return;
      }
      timer = setTimeout(finish, 60000);
      try {
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              if (rewarded) return;
              rewarded = true;
              onRewarded();
            },
            onClose: finish,
            onError: finish,
          },
        });
      } catch (e) {
        finish();
      }
    }
  };

  R.platform = new R.Platform();
})();
