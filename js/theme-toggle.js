/**
 * Interruptor de tema (claro/escuro) na barra lateral.
 */
(function (GE) {
  "use strict";
  const { Preferences } = GE;

  /* ============================================================ */
  /* ---------- Tema (claro/escuro): interruptor na barra lateral ---------- */
  /* ============================================================ */
  const ThemeToggle = {
    btn: document.getElementById("darkModeBtn"),
    init(){
      this.btn.addEventListener("click", () => {
        Preferences.update({ theme: Preferences.get().theme === "dark" ? "light" : "dark" });
        this.render();
      });
      this.render();
    },
    render(){
      const dark = Preferences.get().theme === "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      this.btn.setAttribute("aria-checked", String(dark));
    }
  };

  Object.assign(GE, { ThemeToggle });
})(window.GE = window.GE || {});
