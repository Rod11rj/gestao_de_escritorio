/**
 * Aplicação: navegação entre seções, tela sem seções e backup.
 */
(function (GE) {
  "use strict";
  const { DEFAULT_VIEW, LAST_VIEW_KEY, SUBMODULES, Schema, Section, SectionEditor, Store } = GE;
  const { h } = GE.Dom;

  /* ============================================================ */
  /* ---------- App: navegação, backup e inicialização ---------- */
  /* ============================================================ */
  class App {
    constructor(){
      this.lastViewKey = LAST_VIEW_KEY;
      this.store = new Store();
      this.mainEl = document.getElementById("mainArea");
      this.navEl = document.getElementById("sectionNav");
      this.sections = [];
      this.current = null;
      this.bindBackup();
      document.getElementById("editSectionsBtn").addEventListener("click", () => SectionEditor.open(this));
      this.bindEmptyState();
      this.rebuildSections(this.loadLastView());
    }

    getSection(id){ return this.sections.find(function(s){ return s.id === id; }); }

    // (Re)cria as instâncias de Section a partir da lista salva e redesenha o menu.
    // Chamado na inicialização e sempre que a lista de seções muda.
    rebuildSections(target){
      this.sections.forEach(function(s){ s.destroy(); });
      this.sections = this.store.sectionList.map((def) => new Section(def, this.store, this.mainEl));
      this.buildNav();
      this.navigate(target || this.current || DEFAULT_VIEW);
    }

    buildNav(){
      const nav = this.navEl;
      nav.querySelectorAll(".module-item, .submodule-list, .nav-empty").forEach(function(el){ el.remove(); });
      if(this.sections.length === 0){
        const hint = document.createElement("p");
        hint.className = "nav-empty";
        hint.textContent = "Nenhuma seção ainda.";
        nav.appendChild(hint);
      }
      this.sections.forEach((section) => {
        nav.appendChild(h("button", {
          className:"module-item", type:"button", dataset:{ section:section.id },
          on:{ click:() => this.navigate({ section:section.id, module:SUBMODULES[0].id }) }
        }, [h("span", { className:"dot" }), section.name]));

        const list = document.createElement("div");
        list.className = "submodule-list";
        list.dataset.section = section.id;
        SUBMODULES.forEach((sub) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "submodule-item";
          btn.dataset.module = sub.id;
          btn.textContent = sub.name;
          btn.addEventListener("click", () => this.navigate({ section:section.id, module:sub.id }));
          list.appendChild(btn);
        });
        nav.appendChild(list);
      });
    }

    // Tela mostrada quando o usuário ainda não tem nenhuma seção.
    bindEmptyState(){
      this.emptyEl = document.getElementById("emptyState");
      const input = document.getElementById("firstSectionInput");
      const error = document.getElementById("firstSectionError");
      input.addEventListener("input", function(){ error.textContent = ""; });
      document.getElementById("firstSectionForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = input.value.trim();
        const msg = this.store.validateSectionName(name);
        if(msg){ error.textContent = msg; input.focus(); return; }
        const def = this.store.addSection(name);
        input.value = "";
        this.rebuildSections({ section:def.id, module:SUBMODULES[0].id });
      });
    }

    navigate(target){
      this.sections.forEach(function(s){ s.hideAll(); });
      if(this.sections.length === 0){
        this.current = null;
        this.emptyEl.hidden = false;
        setTimeout(function(){ document.getElementById("firstSectionInput").focus(); }, 0);
        return;
      }
      this.emptyEl.hidden = true;
      target = target || DEFAULT_VIEW;
      const section = this.getSection(target.section) || this.getSection(DEFAULT_VIEW.section) || this.sections[0];
      const moduleId = section.modules[target.module] ? target.module : SUBMODULES[0].id;

      section.module(moduleId).show();
      this.current = { section:section.id, module:moduleId };
      try{ localStorage.setItem(this.lastViewKey, JSON.stringify(this.current)); }catch{ /* lembrar a última tela é opcional */ }

      // Destaque no menu; só a seção ativa mostra seus submódulos.
      document.querySelectorAll("#sectionNav .module-item").forEach(function(b){
        b.classList.toggle("active", b.dataset.section === section.id);
      });
      document.querySelectorAll("#sectionNav .submodule-list").forEach(function(list){
        const isActive = list.dataset.section === section.id;
        list.hidden = !isActive;
        list.querySelectorAll(".submodule-item").forEach(function(b){
          b.classList.toggle("active", isActive && b.dataset.module === moduleId);
        });
      });
    }

    loadLastView(){
      try{
        const saved = JSON.parse(localStorage.getItem(this.lastViewKey));
        if(saved && saved.section) return saved;
      }catch{ /* valor salvo inválido: usa a tela padrão */ }
      return DEFAULT_VIEW;
    }

    refreshCurrent(){
      this.rebuildSections(this.current);
    }

    bindBackup(){
      document.getElementById("exportBtn").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(this.store.data, null, 2)], { type:"application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "gestao-equipe-" + new Date().toISOString().slice(0,10) + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      const importInput = document.getElementById("importInput");
      document.getElementById("importBtn").addEventListener("click", function(){
        importInput.value = "";
        importInput.click();
      });
      importInput.addEventListener("change", () => {
        const file = importInput.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          let parsed;
          try{ parsed = JSON.parse(reader.result); }catch{ parsed = null; }

          if(parsed && parsed.sections){
            if(!confirm("Importar este arquivo vai substituir os dados de TODAS as seções. Continuar?")) return;
            this.store.replaceAll(parsed);
          }else if(Schema.isLegacy(parsed)){
            // Backup antigo (seção única) vai para a seção aberta no momento.
            if(!this.current){ alert("Crie uma seção antes de importar este backup antigo."); return; }
            const target = this.getSection(this.current.section);
            if(!confirm('Este é um backup do formato antigo (seção única). Ele vai substituir os dados da seção "' + target.name + '", que está aberta agora. Continuar?')) return;
            this.store.replaceSection(target.id, Schema.fromLegacy(parsed));
          }else{
            alert("Não foi possível importar o arquivo. Verifique se é um backup exportado por este sistema.");
            return;
          }
          this.refreshCurrent();
        };
        reader.readAsText(file);
      });
    }
  }

  Object.assign(GE, { App });
})(window.GE = window.GE || {});
