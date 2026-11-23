/**
 * Janela de tarefa (compartilhada por todas as seções), seletor de grupo e relatório.
 */
(function (GE) {
  "use strict";
  const { PRIORITY_LABEL, PrintService, Util } = GE;
  const { h } = GE.Dom;

  /* ============================================================ */
  /* ---------- TaskModal: janela de tarefa (compartilhada) ---------- */
  /* ---------- Abre sobre o quadro de qualquer seção. ---------- */
  /* ============================================================ */
  const TaskModal = {
    board: null,
    taskId: null,
    el: {
      overlay: document.getElementById("modalOverlay"),
      title: document.getElementById("taskTitleInput"),
      group: document.getElementById("taskGroup"),
      groupMenu: document.getElementById("taskGroupMenu"),
      groupPicker: document.getElementById("taskGroupPicker"),
      priority: document.getElementById("taskPriority"),
      responsavel: document.getElementById("taskResponsavel"),
      prazo: document.getElementById("taskPrazo"),
      referencia: document.getElementById("taskReferencia"),
      descricao: document.getElementById("taskDescricao"),
      checklist: document.getElementById("taskChecklist"),
      meta: document.getElementById("taskMetaNote")
    },

    get task(){ return (this.board && this.taskId) ? this.board.data.tasks[this.taskId] : null; },
    get isOpen(){ return this.el.overlay.classList.contains("open"); },

    init(){
      const self = this, el = this.el;
      // campo do formulário -> propriedade da tarefa
      const bindings = [
        [el.title, "input", "title"], [el.priority, "change", "priority"],
        [el.responsavel, "input", "responsavel"], [el.prazo, "change", "prazo"],
        [el.referencia, "input", "referencia"], [el.descricao, "input", "descricao"]
      ];
      bindings.forEach(function(b){
        b[0].addEventListener(b[1], function(){
          const task = self.task; if(!task) return;
          task[b[2]] = b[0].value;
          self.board.save();
        });
      });

      // Grupo: lista com "Cadastrar novo" no topo, "Sem grupo" e os grupos existentes.
      el.group.addEventListener("click", function(){
        if(self.groupMenuOpen) self.closeGroupMenu(); else self.openGroupMenu();
      });
      el.group.addEventListener("keydown", function(e){
        if(e.key === "ArrowDown" && !self.groupMenuOpen){ e.preventDefault(); self.openGroupMenu(); }
      });
      el.groupMenu.addEventListener("keydown", function(e){
        const items = Array.from(el.groupMenu.querySelectorAll(".group-option"));
        const i = items.indexOf(document.activeElement);
        if(e.key === "ArrowDown"){ e.preventDefault(); items[Math.min(i + 1, items.length - 1)].focus(); }
        if(e.key === "ArrowUp"){ e.preventDefault(); if(i <= 0) el.group.focus(); else items[i - 1].focus(); }
        if(e.key === "Tab") self.closeGroupMenu();
      });
      document.addEventListener("mousedown", function(e){
        if(self.groupMenuOpen && !el.groupPicker.contains(e.target)) self.closeGroupMenu();
      });

      document.getElementById("addChecklistBtn").addEventListener("click", function(){ self.addChecklistItem(); });
      document.getElementById("deleteTaskBtn").addEventListener("click", function(){
        if(!self.task) return;
        if(!confirm("Excluir esta tarefa? Essa ação não pode ser desfeita.")) return;
        const board = self.board, id = self.taskId;
        self.close();
        board.deleteTask(id);
      });
      document.getElementById("generateReportBtn").addEventListener("click", function(){
        if(self.task) self.printReport();
      });
      document.getElementById("closeModalBtn").addEventListener("click", function(){ self.close(); });
      el.overlay.addEventListener("click", function(e){ if(e.target === el.overlay) self.close(); });
      document.addEventListener("keydown", function(e){
        if(e.key !== "Escape" || !self.isOpen) return;
        if(GE.GroupEditor.isOpen) return;              // Esc fecha só a janela de grupos
        if(self.groupMenuOpen){ self.closeGroupMenu(); el.group.focus(); return; }
        self.close();
      });
    },

    get groupMenuOpen(){ return !this.el.groupMenu.hidden; },

    renderGroupButton(){
      const g = this.board.groupById(this.task.group);
      const dot = this.el.group.querySelector(".gp-dot");
      const text = this.el.group.querySelector(".gp-text");
      dot.classList.toggle("has-color", !!g);
      dot.style.setProperty("--g", g ? this.board.groupColor(g) : "transparent");
      text.textContent = g ? g.name : "Sem grupo";
      text.classList.toggle("placeholder", !g);
    },

    openGroupMenu(){
      const self = this, board = this.board, menu = this.el.groupMenu;
      const current = this.task.group || "";
      menu.innerHTML = "";
      const addOption = function(opts){
        const attrs = { role:"option" };
        if(!opts.create) attrs["aria-selected"] = String(opts.id === current);
        const b = h("button", { type:"button", className:"group-option" + (opts.create ? " create" : ""), attrs:attrs, on:{ click:opts.onClick } },
          opts.create
            ? [h("span", { className:"go-plus", attrs:{ "aria-hidden":"true" }, text:"+" }), h("span", { className:"go-name", text:"Cadastrar novo grupo" })]
            : [h("span", { className:"gp-dot" + (opts.color ? " has-color" : ""), style:opts.color ? { "--g":opts.color } : null }),
               h("span", { className:"go-name", text:opts.name }),
               h("span", { className:"go-check", attrs:{ "aria-hidden":"true" }, text:"✓" })]);
        menu.appendChild(b);
        return b;
      };
      addOption({ create:true, onClick:function(){ self.createGroupFromTask(); } });
      menu.appendChild(h("div", { className:"group-menu-sep" }));
      addOption({ id:"", name:"Sem grupo", onClick:function(){ self.selectGroup(""); } });
      if(board.groups.length){
        menu.appendChild(h("div", { className:"group-menu-label", text:"Grupos da seção " + board.section.name }));
        board.groups.slice().sort(function(a, b){ return a.name.localeCompare(b.name, "pt-BR"); }).forEach(function(g){
          addOption({ id:g.id, name:g.name, color:board.groupColor(g), onClick:function(){ self.selectGroup(g.id); } });
        });
      }
      menu.hidden = false;
      this.el.group.setAttribute("aria-expanded", "true");
      (menu.querySelector('[aria-selected="true"]') || menu.querySelector(".group-option")).focus();
    },

    closeGroupMenu(){
      this.el.groupMenu.hidden = true;
      this.el.group.setAttribute("aria-expanded", "false");
    },

    selectGroup(id){
      this.task.group = id;
      this.board.save();
      this.renderGroupButton();
      this.closeGroupMenu();
      this.el.group.focus();
    },

    // "Cadastrar novo grupo": abre a janela de grupos; o grupo criado já fica selecionado na tarefa.
    createGroupFromTask(){
      const self = this;
      this.closeGroupMenu();
      GE.GroupEditor.open(this.board, {
        onCreate: function(group){
          if(!self.task) return;
          self.task.group = group.id;
          self.board.save();
          self.renderGroupButton();
        },
        onClose: function(){ if(self.isOpen){ self.renderGroupButton(); self.el.group.focus(); } }
      });
    },

    open(board, taskId, selectTitle){
      this.board = board;
      this.taskId = taskId;
      const task = this.task;
      if(!task) return;
      const el = this.el;
      el.title.value = task.title;
      this.closeGroupMenu();
      this.renderGroupButton();
      el.priority.value = task.priority;
      el.responsavel.value = task.responsavel;
      el.prazo.value = task.prazo;
      el.referencia.value = task.referencia || "";
      el.descricao.value = task.descricao;
      this.renderChecklist();
      const col = board.columnOf(taskId);
      el.meta.textContent = board.section.name + (col ? " · Coluna: " + col.title : "");
      el.overlay.classList.add("open");
      el.title.focus();
      if(selectTitle) el.title.select();
    },

    close(){
      this.closeGroupMenu();
      const board = this.board;
      this.el.overlay.classList.remove("open");
      this.board = null;
      this.taskId = null;
      if(board) board.render();
    },

    renderChecklist(){
      const wrap = this.el.checklist;
      wrap.innerHTML = "";
      (this.task.checklist || []).forEach((item) => { wrap.appendChild(this.renderChecklistItem(item)); });
    },

    renderChecklistItem(item){
      const self = this;
      const row = h("div", { className:"checklist-item" + (item.done ? " done" : "") }, [
        h("input", { type:"checkbox", checked:item.done, attrs:{ "aria-label":"Concluído" }, on:{ change:function(){
          item.done = this.checked;
          row.classList.toggle("done", item.done);
          self.board.save();
        } } }),
        h("input", { type:"text", value:item.text, placeholder:"Item do checklist", attrs:{ "aria-label":"Item do checklist" }, on:{
          input:function(){ item.text = this.value; self.board.save(); },
          keydown:function(e){ if(e.key === "Enter"){ e.preventDefault(); self.addChecklistItem(); } }
        } }),
        h("button", { className:"checklist-remove", type:"button", title:"Remover", attrs:{ "aria-label":"Remover item" }, text:"✕", on:{ click:function(){
          const task = self.task;
          task.checklist = task.checklist.filter(function(i){ return i.id !== item.id; });
          self.board.save();
          self.renderChecklist();
        } } })
      ]);
      return row;
    },

    addChecklistItem(){
      const task = this.task;
      if(!task) return;
      task.checklist = task.checklist || [];
      task.checklist.push({ id:Util.uid("chk"), text:"", done:false });
      this.board.save();
      this.renderChecklist();
      const inputs = this.el.checklist.querySelectorAll('input[type="text"]');
      if(inputs.length) inputs[inputs.length - 1].focus();
    },

    printReport(){
      const task = this.task, board = this.board;
      try{
        const col = board.columnOf(task.id);
        const checklist = task.checklist || [];
        const doneCount = checklist.filter(function(i){ return i.done; }).length;
        const fields = [
          ["Seção", board.section.name],
          ["Grupo", (board.groupById(task.group) || { name:"—" }).name],
          ["Prioridade", PRIORITY_LABEL[task.priority] || task.priority],
          ["Responsável", task.responsavel || "—"],
          ["Prazo", task.prazo ? Util.formatDate(task.prazo) : "—"],
          ["Referência", task.referencia || "—"],
          ["Coluna atual", col ? col.title : "—"]
        ];
        const report = h("div", { className:"task-report" }, [
          h("div", { className:"task-report-header" }, [
            h("span", { className:"task-report-eyebrow", text:"Relatório de tarefa · " + board.section.name + " · Tarefas" }),
            h("h1", { text:task.title || "Sem título" })
          ]),
          h("div", { className:"task-report-grid" }, fields.map(function(f){
            return h("div", { className:"task-report-row" }, [
              h("span", { className:"task-report-label", text:f[0] }),
              h("span", { className:"task-report-value", text:f[1] })
            ]);
          })),
          h("div", { className:"task-report-section" }, [
            h("h3", { text:"Situação" }),
            task.descricao ? h("p", { text:task.descricao }) : h("p", null, h("em", { text:"Sem situação registrada." }))
          ]),
          checklist.length ? h("div", { className:"task-report-section" }, [
            h("h3", { text:"Checklist (" + doneCount + "/" + checklist.length + ")" }),
            h("ul", { className:"task-report-checklist" }, checklist.map(function(item){
              return h("li", { className:item.done ? "done" : "", text:(item.done ? "☑ " : "☐ ") + (item.text || "(sem descrição)") });
            }))
          ]) : null,
          h("div", { className:"task-report-footer", text:"Gerado em " + Util.formatNow() })
        ]);
        PrintService.printNode(report, "portrait");
      }catch(err){
        console.error("Falha ao gerar o relatório:", err);
        alert("Não foi possível gerar o relatório. Tente novamente.");
        PrintService.root.innerHTML = "";
      }
    }
  };

  Object.assign(GE, { TaskModal });
})(window.GE = window.GE || {});
