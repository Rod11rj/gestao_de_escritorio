/**
 * Preferências salvas neste navegador (tema claro/escuro).
 */
(function (GE) {
  "use strict";
  const { Migration, PREFS_KEY, isObj } = GE;

  /* ============================================================ */
  /* ---------- Preferences: preferências salvas neste navegador (tema) ---------- */
  /* ============================================================ */
  const Preferences = {
    get(){
      let p = Migration.readJson(PREFS_KEY);
      if(!isObj(p)) p = { theme:(Migration.previousProfile() || {}).theme };
      return { theme: p.theme === "dark" ? "dark" : "light" };
    },
    update(patch){
      const p = Object.assign(this.get(), patch);
      localStorage.setItem(PREFS_KEY, JSON.stringify({ theme:p.theme }));
    }
  };

  Object.assign(GE, { Preferences });
})(window.GE = window.GE || {});
