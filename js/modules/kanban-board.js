/**
 * Submódulo "Tarefas": quadro Kanban com colunas, cartões, grupos e filtros.
 */
(function (GE) {
  "use strict";
  const { GROUP_NAME_MAX, GROUP_PALETTE, GROUP_PALETTE_HEX, PRIORITY_LABEL, PrintService, SectionModule, Util, hasOwn } = GE;
  const { h, inlineEditable } = GE.Dom;

  /* ============================================================ */
  /* ---------- KanbanBoard (submódulo "Tarefas") ---------- */
  /* ============================================================ */
  class KanbanBoard extends SectionModule {
    constructor(section){
      super(section, "tplKanban", "kanban");
      this.activeFilter = "todos";
      this.searchTerm = "";
      this.boardEl = this.$(".board");
      this.bindHeader();
    }

    bindHeader(){
      const titleEl = this.$(".board-title");
      titleEl.addEventListener("blur", () => {
        this.data.boardTitle = titleEl.textContent.trim() || "Quadro da Equipe";
        titleEl.textContent = this.data.boardTitle;
        this.save();
      });
      titleEl.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); titleEl.blur(); }
      });

      this.on(".js-search", "input", function(e){
        this.searchTerm = e.target.value.trim().toLowerCase();
        this.render();
      });

      this.on(".js-group-filter", "click", function(e){
        const btn = e.target.closest(".chip");
        if(!btn) return;
        this.activeFilter = btn.dataset.group;
        this.render();
      });
      this.on(".js-manage-groups", "click", function(){ GE.GroupEditor.open(this); });

      this.on(".js-export-pdf", "click", this.exportPdf);
    }

    /* ---------- Grupos (definidos pelo usuário) ---------- */
    get groups(){ return this.data.groups; }
    groupById(id){ return id ? this.data.groups.find(function(g){ return g.id === id; }) || null : null; }
    groupByName(name){
      const lower = String(name || "").trim().toLocaleLowerCase("pt-BR");
      return this.data.groups.find(function(g){ return g.name.toLocaleLowerCase("pt-BR") === lower; }) || null;
    }
    groupColor(group){
      const c = group && group.color;
      if(GROUP_PALETTE_HEX[c]) return GROUP_PALETTE_HEX[c];
      return /^#[0-9a-f]{6}$/i.test(c || "") ? c : GROUP_PALETTE_HEX.slate;
    }
    groupTaskCount(groupId){
      return Object.values(this.data.tasks).filter(function(t){ return t.group === groupId; }).length;
    }

    // Retorna uma mensagem de erro, ou "" se o nome for válido.
    validateGroupName(name, ignoreId){
      const clean = String(name || "").trim();
      if(!clean) return "Informe um nome para o grupo.";
      if(clean.length > GROUP_NAME_MAX) return "Use no máximo " + GROUP_NAME_MAX + " caracteres.";
      const dup = this.groupByName(clean);
      return (dup && dup.id !== ignoreId) ? 'Já existe um grupo chamado "' + dup.name + '".' : "";
    }

    addGroup(name){
      // próxima cor ainda não usada (ou a sequência, se todas já foram usadas)
      const used = this.data.groups.map(function(g){ return g.color; });
      const color = GROUP_PALETTE.find(function(c){ return used.indexOf(c) === -1; }) ||
        GROUP_PALETTE[this.data.groups.length % GROUP_PALETTE.length];
      const group = { id:Util.uid("grp"), name:String(name).trim(), color:color };
      this.data.groups.push(group);
      this.save();
      return group;
    }

    // Nome digitado na tarefa -> id do grupo (cria o grupo se ainda não existir).
    resolveGroupName(name){
      const clean = String(name || "").trim().slice(0, GROUP_NAME_MAX);
      if(!clean) return "";
      const existing = this.groupByName(clean);
      return existing ? existing.id : this.addGroup(clean).id;
    }

    renameGroup(id, name){
      const g = this.groupById(id);
      if(!g) return;
      g.name = String(name).trim();
      this.save();
    }

    setGroupColor(id, color){
      const g = this.groupById(id);
      if(!g) return;
      g.color = color;
      this.save();
    }

    deleteGroup(id){
      this.data.groups = this.data.groups.filter(function(g){ return g.id !== id; });
      Object.values(this.data.tasks).forEach(function(t){ if(t.group === id) t.group = ""; });
      if(this.activeFilter === id) this.activeFilter = "todos";
      this.save();
    }

    renderFilters(){
      const wrap = this.$(".js-group-filter");
      const groups = this.data.groups;
      const hasUngrouped = Object.values(this.data.tasks).some(function(t){ return !t.group; });
      if(this.activeFilter !== "todos" && this.activeFilter !== "__none__" && !this.groupById(this.activeFilter)){
        this.activeFilter = "todos";
      }
      const chips = [{ id:"todos", name:"Todos" }]
        .concat(groups.map((g) => ({ id:g.id, name:g.name, color:this.groupColor(g) })));
      if(groups.length && hasUngrouped) chips.push({ id:"__none__", name:"Sem grupo" });
      wrap.innerHTML = "";
      chips.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        btn.dataset.group = c.id;
        btn.dataset.active = String(this.activeFilter === c.id);
        if(c.color){
          const sw = document.createElement("span");
          sw.className = "swatch";
          sw.style.background = c.color;
          btn.appendChild(sw);
        }
        btn.appendChild(document.createTextNode(c.name));
        wrap.appendChild(btn);
      });
    }

    matchesFilters(task){
      if(this.activeFilter === "__none__" && task.group) return false;
      if(this.activeFilter !== "todos" && this.activeFilter !== "__none__" && task.group !== this.activeFilter) return false;
      if(this.searchTerm){
        const hay = (task.title + " " + task.responsavel + " " + task.descricao).toLowerCase();
        if(hay.indexOf(this.searchTerm) === -1) return false;
      }
      return true;
    }

    render(){
      this.$(".board-title").textContent = this.data.boardTitle || "Quadro da Equipe";
      this.renderFilters();
      this.boardEl.innerHTML = "";
      this.data.columns.forEach((col) => { this.boardEl.appendChild(this.renderColumn(col)); });

      this.boardEl.appendChild(h("div", { className:"add-column" },
        h("button", { className:"add-column-btn", type:"button", text:"+ Nova coluna", on:{ click:() => this.addColumn() } })));
    }

    renderColumn(col){
      const tasks = this.data.tasks;
      const visibleIds = col.taskIds.filter((id) => tasks[id] && this.matchesFilters(tasks[id]));

      const wrap = h("section", { className:"column", dataset:{ columnId:col.id } });

      const titleEl = inlineEditable(h("h2", { className:"column-title", text:col.title }), (text) => {
        col.title = text || "Sem título";
        titleEl.textContent = col.title;
        this.save();
      });
      wrap.appendChild(h("div", { className:"column-head" }, [
        titleEl,
        h("span", { className:"column-count", text:visibleIds.length }),
        h("button", { className:"column-menu-btn", type:"button", title:"Excluir coluna", attrs:{ "aria-label":"Excluir coluna" }, text:"✕",
          on:{ click:(e) => { e.stopPropagation(); this.deleteColumn(col.id); } } })
      ]));

      const body = document.createElement("div");
      body.className = "column-body";
      body.addEventListener("dragover", function(e){ e.preventDefault(); wrap.classList.add("drop-target"); });
      body.addEventListener("dragleave", function(){ wrap.classList.remove("drop-target"); });
      body.addEventListener("drop", (e) => {
        e.preventDefault();
        wrap.classList.remove("drop-target");
        this.moveTaskToColumn(e.dataTransfer.getData("text/plain"), col.id);
      });

      if(visibleIds.length === 0){
        const hint = document.createElement("div");
        hint.className = "empty-column-hint";
        hint.textContent = col.taskIds.length === 0 ? "Nenhuma tarefa" : "Nenhum resultado com os filtros atuais";
        body.appendChild(hint);
      }else{
        visibleIds.forEach((id) => { body.appendChild(this.renderCard(tasks[id])); });
      }
      wrap.appendChild(body);

      wrap.appendChild(h("div", { className:"column-foot" },
        h("button", { className:"add-task-btn", type:"button", text:"+ Adicionar tarefa", on:{ click:() => this.createTask(col.id) } })));

      return wrap;
    }

    renderCard(task){
      const group = this.groupById(task.group);
      const groupHex = group ? this.groupColor(group) : null;
      const priority = hasOwn(PRIORITY_LABEL, task.priority) ? task.priority : "media";
      const checklist = task.checklist || [];
      const doneCount = checklist.filter(function(i){ return i.done; }).length;

      const due = [];
      if(task.prazo) due.push(Util.formatDate(task.prazo));
      if(checklist.length) due.push(h("span", { className:"task-checklist-progress", text:doneCount + "/" + checklist.length }));

      const card = h("article", {
        className:"task-card",
        dataset:{ taskId:task.id },
        draggable:true,
        style: groupHex ? { "border-left-color":groupHex } : null,
        on:{
          click:() => GE.TaskModal.open(this, task.id),
          dragstart:(e) => { e.dataTransfer.setData("text/plain", task.id); card.classList.add("dragging"); },
          dragend:() => card.classList.remove("dragging")
        }
      }, [
        h("div", { className:"task-title", text:task.title || "Sem título" }),
        task.referencia ? h("div", { className:"task-reference", text:task.referencia }) : null,
        h("div", { className:"task-meta" }, [
          group ? h("span", { className:"badge badge-group", style:{ "--g":groupHex }, text:group.name }) : null,
          h("span", { className:"badge badge-priority-" + priority, text:"Prioridade " + PRIORITY_LABEL[priority].toLowerCase() })
        ]),
        h("div", { className:"task-foot" }, [
          h("span", { className:"task-responsavel" }, task.responsavel
            ? [h("span", { className:"avatar", text:Util.initials(task.responsavel) }), h("span", { text:task.responsavel })]
            : h("span", { text:"Sem responsável" })),
          h("span", null, due.reduce(function(acc, part, i){ return i ? acc.concat(" · ", part) : [part]; }, []))
        ])
      ]);
      return card;
    }

    /* ---------- Colunas ---------- */
    addColumn(){
      const col = { id:Util.uid("col"), title:"Nova coluna", taskIds:[] };
      this.data.columns.push(col);
      this.save();
      this.render();
      const el = this.$('.column[data-column-id="' + col.id + '"] .column-title');
      if(el) Util.selectContents(el);
    }

    deleteColumn(colId){
      const col = this.data.columns.find(function(c){ return c.id === colId; });
      if(!col) return;
      const msg = col.taskIds.length > 0
        ? 'Excluir a coluna "' + col.title + '" e suas ' + col.taskIds.length + ' tarefa(s)?'
        : 'Excluir a coluna "' + col.title + '"?';
      if(!confirm(msg)) return;
      col.taskIds.forEach((id) => { delete this.data.tasks[id]; });
      this.data.columns = this.data.columns.filter(function(c){ return c.id !== colId; });
      this.save();
      this.render();
    }

    moveTaskToColumn(taskId, colId){
      if(!this.data.tasks[taskId]) return;
      this.data.columns.forEach(function(c){
        c.taskIds = c.taskIds.filter(function(id){ return id !== taskId; });
      });
      const target = this.data.columns.find(function(c){ return c.id === colId; });
      if(target) target.taskIds.push(taskId);
      this.save();
      this.render();
    }

    /* ---------- Tarefas ---------- */
    createTask(colId){
      const task = {
        id:Util.uid("task"), title:"Nova tarefa", group:this.groupById(this.activeFilter) ? this.activeFilter : "",
        responsavel:"", priority:"media", prazo:"", referencia:"", descricao:"", checklist:[], createdAt:Date.now()
      };
      this.data.tasks[task.id] = task;
      const col = this.data.columns.find(function(c){ return c.id === colId; });
      col.taskIds.push(task.id);
      this.save();
      this.render();
      GE.TaskModal.open(this, task.id, true);
    }

    deleteTask(taskId){
      delete this.data.tasks[taskId];
      this.data.columns.forEach(function(c){
        c.taskIds = c.taskIds.filter(function(id){ return id !== taskId; });
      });
      this.save();
      this.render();
    }

    columnOf(taskId){
      return this.data.columns.find(function(c){ return c.taskIds.indexOf(taskId) !== -1; });
    }

    /* ---------- PDF ---------- */
    exportPdf(){
      const stamp = this.section.name + " · Quadro: " + (this.data.boardTitle || "Quadro da Equipe");
      PrintService.exportView(this.root, "portrait", stamp, function(root){
        const boardEl = root.querySelector(".board");
        const headerEl = root.querySelector(".board-header");
        let maxColHeight = 0;
        root.querySelectorAll(".column").forEach(function(col){
          const head = col.querySelector(".column-head");
          const body = col.querySelector(".column-body");
          const foot = col.querySelector(".column-foot");
          const total = (head ? head.offsetHeight : 0) + (body ? body.scrollHeight : 0) + (foot ? foot.offsetHeight : 0) + 4;
          if(total > maxColHeight) maxColHeight = total;
        });
        return { width: boardEl.scrollWidth, height: (headerEl ? headerEl.offsetHeight : 0) + maxColHeight + 24 };
      });
    }
  }

  Object.assign(GE, { KanbanBoard });
})(window.GE = window.GE || {});
