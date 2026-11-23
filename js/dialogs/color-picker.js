/**
 * Quadro de escolha de cor dos grupos.
 */
(function (GE) {
  "use strict";
  const { GROUP_PALETTE, GROUP_PALETTE_HEX, GROUP_PALETTE_NAMES } = GE;

  /* ============================================================ */
  /* ---------- ColorPicker: quadro de cores dos grupos ---------- */
  /* ============================================================ */
  const ColorPicker = {
    el: {
      pop: document.getElementById("colorPopover"),
      grid: document.getElementById("colorGrid"),
      custom: document.getElementById("colorCustom")
    },
    anchor: null,
    onPick: null,
    get isOpen(){ return !this.el.pop.hidden; },

    init(){
      const self = this, el = this.el;
      GROUP_PALETTE.forEach(function(key){
        const b = document.createElement("button");
        b.type = "button";
        b.className = "color-swatch";
        b.dataset.color = key;
        b.style.background = GROUP_PALETTE_HEX[key];
        b.title = GROUP_PALETTE_NAMES[key];
        b.setAttribute("aria-label", GROUP_PALETTE_NAMES[key]);
        b.addEventListener("click", function(){ self.pick(key); });
        el.grid.appendChild(b);
      });
      el.custom.addEventListener("change", function(){ self.pick(el.custom.value); });
      document.addEventListener("mousedown", function(e){
        if(self.isOpen && !el.pop.contains(e.target) && e.target !== self.anchor) self.close();
      });
      window.addEventListener("resize", function(){ self.close(); });
    },

    open(anchor, current, onPick){
      if(this.isOpen && this.anchor === anchor){ this.close(); return; }
      this.anchor = anchor;
      this.onPick = onPick;
      this.el.grid.querySelectorAll(".color-swatch").forEach(function(b){
        b.setAttribute("aria-pressed", String(b.dataset.color === current));
      });
      this.el.custom.value = GROUP_PALETTE_HEX[current] || (/^#[0-9a-f]{6}$/i.test(current || "") ? current : "#5b6b45");
      const pop = this.el.pop;
      pop.hidden = false;
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      const left = Math.min(r.left, window.innerWidth - w - 8);
      let top = r.bottom + 6;
      if(top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      pop.style.left = Math.max(8, left) + "px";
      pop.style.top = top + "px";
      (pop.querySelector('[aria-pressed="true"]') || pop.querySelector(".color-swatch")).focus();
    },

    pick(color){
      if(this.onPick) this.onPick(color);
      const anchor = this.anchor;
      this.close();
      if(anchor) anchor.focus();
    },

    close(){
      this.el.pop.hidden = true;
      this.anchor = null;
      this.onPick = null;
    }
  };

  Object.assign(GE, { ColorPicker });
})(window.GE = window.GE || {});
