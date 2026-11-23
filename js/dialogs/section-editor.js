/**
 * Janela "Editar seções": criar, renomear, reordenar e excluir seções.
 */
(function (GE) {
  "use strict";
  const { SECTION_NAME_MAX } = GE;
  const { h } = GE.Dom;

  /* ============================================================ */
  /* ---------- SectionEditor: janela "Editar seções" ---------- */
  /* ---------- Cria, renomeia, reordena e exclui seções. Cada mudança é  */
  /* ---------- gravada no Store e o App reconstrói as seções na hora. */
  /* ============================================================ */
  const SectionEditor = {
    app: null,
    el: {
      overlay: document.getElementById("sectionsModalOverlay"),
      list: document.getElementById("sectionEditorList"),
      error: document.getElementById("sectionEditorError"),
      addForm: document.getElementById("sectionAddForm"),
      newInput: document.getElementById("newSectionInput")
    },

    get store(){ return this.app.store; },
    get isOpen(){ return this.el.overlay.classList.contains("open"); },

    init(){
      const self = this, el = this.el;
      el.addForm.addEventListener("submit", function(e){
        e.preventDefault();
        self.add();
      });
      el.newInput.addEventListener("input", function(){ self.setError(""); });
      document.getElementById("closeSectionsModalBtn").addEventListener("click", function(){ self.close(); });
      document.getElementById("sectionsDoneBtn").addEventListener("click", function(){ self.close(); });
      el.overlay.addEventListener("click", function(e){ if(e.target === el.overlay) self.close(); });
      document.addEventListener("keydown", function(e){ if(e.key === "Escape" && self.isOpen) self.close(); });
    },

    open(app){
      this.app = app;
      this.setError("");
      this.el.newInput.value = "";
      this.render();
      this.el.overlay.classList.add("open");
    },

    close(){
      this.el.overlay.classList.remove("open");
    },

    setError(msg){ this.el.error.textContent = msg; },

    statsLabel(stats){
      const parts = [];
      if(stats.tasks) parts.push(stats.tasks + (stats.tasks === 1 ? " tarefa" : " tarefas"));
      if(stats.activities) parts.push(stats.activities + (stats.activities === 1 ? " atividade" : " atividades"));
      return parts.length ? parts.join(" · ") : "vazia";
    },

    render(){
      const list = this.el.list, store = this.store, self = this;
      const defs = store.sectionList;
      list.innerHTML = "";
      defs.forEach(function(def, idx){
        const input = h("input", {
          className:"section-editor-name", type:"text", maxLength:SECTION_NAME_MAX, value:def.name,
          attrs:{ "aria-label":"Nome da seção" },
          on:{
            keydown:function(e){
              if(e.key === "Enter"){ e.preventDefault(); input.blur(); }
              if(e.key === "Escape"){ input.value = def.name; }
            },
            change:function(){ self.rename(def.id, input); }
          }
        });
        const iconBtn = function(cls, symbol, label, disabled, onClick){
          return h("button", { className:"icon-btn " + cls, type:"button", title:label, attrs:{ "aria-label":label },
            text:symbol, disabled:disabled, on:{ click:onClick } });
        };
        list.appendChild(h("div", {
          className:"section-editor-row" + (self.app.current && self.app.current.section === def.id ? " current" : "")
        }, [
          h("span", { className:"section-editor-pos", text:idx + 1 }),
          input,
          h("span", { className:"section-editor-stats", text:self.statsLabel(store.sectionStats(def.id)) }),
          iconBtn("js-up", "↑", "Mover para cima", idx === 0, function(){ self.move(def.id, -1); }),
          iconBtn("js-down", "↓", "Mover para baixo", idx === defs.length - 1, function(){ self.move(def.id, 1); }),
          iconBtn("danger js-delete", "✕", "Excluir seção", false, function(){ self.remove(def.id); })
        ]));
      });
    },

    add(){
      const name = this.el.newInput.value.trim();
      const error = this.store.validateSectionName(name);
      if(error){ this.setError(error); this.el.newInput.focus(); return; }
      const def = this.store.addSection(name);
      this.setError("");
      this.el.newInput.value = "";
      // Abre a seção nova para o usuário já ver o resultado.
      this.app.rebuildSections({ section:def.id, module:GE.SUBMODULES[0].id });
      this.render();
      this.el.newInput.focus();
    },

    rename(id, input){
      const def = this.store.sectionDef(id);
      const name = input.value.trim();
      if(name === def.name) { input.value = def.name; return; }
      const error = this.store.validateSectionName(name, id);
      if(error){
        this.setError(error);
        input.value = def.name;
        return;
      }
      this.setError("");
      this.store.renameSection(id, name);
      input.value = name;
      this.app.rebuildSections();
    },

    move(id, delta){
      this.setError("");
      this.store.moveSection(id, delta);
      this.app.rebuildSections();
      this.render();
      // mantém o foco na seta da linha movida, para mover várias vezes seguidas
      const idx = this.store.sectionList.findIndex(function(d){ return d.id === id; });
      const row = this.el.list.children[idx];
      if(row){
        const btn = row.querySelector(delta < 0 ? ".js-up" : ".js-down");
        (btn.disabled ? row.querySelector(".section-editor-name") : btn).focus();
      }
    },

    remove(id){
      const def = this.store.sectionDef(id);
      const s = this.store.sectionStats(id);
      const hasData = s.tasks || s.activities || s.requests || s.entities;
      const msg = hasData
        ? 'Excluir a seção "' + def.name + '"?\n\nIsso apaga definitivamente ' +
          s.tasks + ' tarefa(s), ' + s.entities + ' entidade(s), ' + s.activities + ' atividade(s) e ' +
          s.requests + ' solicitação(ões) desta seção.\n\nSe quiser guardar esses dados, cancele e use "Exportar backup" antes.'
        : 'Excluir a seção "' + def.name + '"? Ela está vazia.';
      if(!confirm(msg)) return;
      this.setError("");
      this.store.deleteSection(id);
      this.app.rebuildSections();
      this.render();
    }
  };

  Object.assign(GE, { SectionEditor });
})(window.GE = window.GE || {});
