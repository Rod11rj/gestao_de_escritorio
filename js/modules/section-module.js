/**
 * Classe-base dos submódulos de uma seção (Tarefas e Calendário).
 */
(function (GE) {
  "use strict";
  /* ============================================================ */
  /* ---------- SectionModule: classe-base dos submódulos ---------- */
  /* ---------- Cada seção cria uma instância de cada submódulo; a  */
  /* ---------- instância clona seu modelo de tela e lê/grava apenas */
  /* ---------- a sua fatia de dados (store.sections[id][dataKey]).  */
  /* ============================================================ */
  class SectionModule {
    constructor(section, templateId, dataKey){
      this.section = section;
      this.dataKey = dataKey;
      this.root = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
      this.root.hidden = true;
      this.root.dataset.section = section.id;
      this.root.querySelectorAll(".section-eyebrow").forEach(function(el){ el.textContent = section.name; });
      section.container.appendChild(this.root);
    }

    get data(){ return this.section.store.section(this.section.id)[this.dataKey]; }
    get isVisible(){ return !this.root.hidden; }

    $(selector){ return this.root.querySelector(selector); }
    $$(selector){ return Array.from(this.root.querySelectorAll(selector)); }
    on(selector, event, handler){ this.$(selector).addEventListener(event, handler.bind(this)); }

    save(){ this.section.store.save(); }

    show(){ this.root.hidden = false; this.onShow(); }
    hide(){ this.root.hidden = true; }

    // Pontos de extensão das subclasses
    onShow(){ this.render(); }
    render(){}
    refresh(){ if(this.isVisible) this.render(); }
  }

  Object.assign(GE, { SectionModule });
})(window.GE = window.GE || {});
