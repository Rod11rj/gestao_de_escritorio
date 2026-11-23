/**
 * Seção: agrupa uma instância de cada submódulo.
 */
(function (GE) {
  "use strict";
  const { ActivityCalendar, KanbanBoard } = GE;

  /* ============================================================ */
  /* ---------- Section: agrupa as instâncias dos submódulos ---------- */
  /* ============================================================ */
  // Submódulos disponíveis em toda seção, na ordem do menu.
  const SUBMODULES = [
    { id:"kanban",   name:"Tarefas",    ModuleClass:KanbanBoard },
    { id:"calendar", name:"Calendário", ModuleClass:ActivityCalendar }
  ];

  class Section {
    constructor(def, store, container){
      this.id = def.id;
      this.name = def.name;
      this.store = store;
      this.container = container;
      this.modules = {};
      SUBMODULES.forEach((sub) => { this.modules[sub.id] = new sub.ModuleClass(this); });
    }
    module(id){ return this.modules[id]; }
    hideAll(){ Object.values(this.modules).forEach(function(m){ m.hide(); }); }
    destroy(){ Object.values(this.modules).forEach(function(m){ m.root.remove(); }); }
  }

  Object.assign(GE, { SUBMODULES, Section });
})(window.GE = window.GE || {});
