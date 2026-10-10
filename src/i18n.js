(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // The game speaks Russian and English. Players from Russian-speaking countries get Russian,
  // everyone else English.
  const RUSSIAN = ['ru', 'be', 'kk', 'uk', 'uz'];

  R.langFor = function (code) {
    return RUSSIAN.includes(String(code || '').toLowerCase().slice(0, 2)) ? 'ru' : 'en';
  };

  // ?lang=en|ru in the address wins, then the browser language, then Russian.
  R.detectLang = function (search, browserLang) {
    const m = /[?&]lang=([a-zA-Z-]+)/.exec(search || '');
    if (m) return R.langFor(m[1]);
    return browserLang ? R.langFor(browserLang) : 'ru';
  };

  R.lang = R.detectLang(
    typeof location !== 'undefined' ? location.search : '',
    typeof navigator !== 'undefined' ? navigator.language : ''
  );

  // The platform SDK reports its own language: see platform.js.
  R.setLang = function (code) {
    R.lang = R.langFor(code);
  };

  // R.t('по-русски', 'in English'): the text for the current language. Use it at the moment the
  // text is shown, never at load time, because the language can change once the SDK is ready.
  R.t = function (ru, en) {
    return R.lang === 'ru' ? ru : en;
  };

  // For texts kept as data: either a plain string or a [ru, en] pair.
  R.tt = function (value) {
    return Array.isArray(value) ? R.t(value[0], value[1]) : value;
  };
})();
