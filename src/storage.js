(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  // Saves (best time, diamonds, shop). Uses the browser's localStorage, or the platform's own safe
  // storage once it is attached (R.storage.useBackend), and keeps working in memory when neither
  // is available (private mode, a blocked iframe, tests): the game then just does not remember
  // anything after a reload. Never throws.
  const memory = new Map();
  let backend = null;

  function active() {
    if (backend) return backend;
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null; // reading the global can throw in a sandboxed iframe
    }
  }

  R.storage = {
    getItem(key) {
      try {
        const b = active();
        const v = b ? b.getItem(key) : null;
        if (v !== null && v !== undefined) return v;
      } catch (e) {
        /* fall through to memory */
      }
      return memory.has(key) ? memory.get(key) : null;
    },

    setItem(key, value) {
      const text = String(value);
      try {
        const b = active();
        if (b) {
          b.setItem(key, text);
          memory.delete(key);
          return;
        }
      } catch (e) {
        /* fall through to memory */
      }
      memory.set(key, text);
    },

    removeItem(key) {
      memory.delete(key);
      try {
        const b = active();
        if (b) b.removeItem(key);
      } catch (e) {
        /* nothing to do */
      }
    },

    useBackend(b) {
      backend = b;
    },

    clearMemory() {
      memory.clear();
    },
  };
})();
