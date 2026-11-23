/**
 * Janela "Grupos de tarefas": criar, renomear, colorir e excluir grupos.
 */
(function (GE) {
  "use strict";
  const { ColorPicker, GROUP_NAME_MAX, TaskModal } = GE;
  const { h } = GE.Dom;

  /* ============================================================ */
  /* ---------- GroupEditor: janela "Grupos de tarefas" ---------- */
  /* ---------- Cria, renomeia, troca a cor e exclui grupos de um quadro. */
  /* ============================================================ */
  const GroupEditor = {
    board: null,
    el: {
      overlay: document.getElementById("groupsModalOverlay"),
      hint: document.getElementById("groupsModalHint"),
      list: document.getElementById("groupEditorList"),
      error: document.getElementById("groupEditorError"),
      addForm: document.getElementById("groupAddForm"),
      newInput: document.getElementById("newGroupInput")
    },
    get isOpen(){ return this.el.overlay.classList.contains("open"); },

    init(){
      const self = this, el = this.el;
      el.addForm.addEventListener("submit", function(e){ e.preventDefault(); self.add(); });
      el.newInput.addEventListener("input", function(){ self.setError(""); });
      document.getElementById("closeGroupsModalBtn").addEventListener("click", function(){ self.close(); });
      document.getElementById("groupsDoneBtn").addEventListener("click", function(){ self.close(); });
      el.overlay.addEventListener("click", function(e){ if(e.target === el.overlay) self.close(); });
      document.addEventListener("keydown", function(e){
        if(e.key !== "Escape" || !self.isOpen) return;
        if(ColorPicker.isOpen){ ColorPicker.close(); return; }
        self.close();
      });
    },

    // options.onCreate(group): chamado ao criar um grupo (usado pela janela da tarefa)
    // options.onClose(): chamado ao fechar
    open(board, options){
      this.board = board;
      this.options = options || {};
      this.setError("");
      this.el.newInput.value = "";
      this.el.hint.textContent = "Especifique os grupos da seção de " + board.section.name;
      this.render();
      this.el.overlay.classList.add("open");
      this.el.newInput.focus();
    },

    close(){
      ColorPicker.close();
      this.el.overlay.classList.remove("open");
      const onClose = this.options && this.options.onClose;
      // o quadro só é redesenhado se a janela da tarefa não estiver aberta por cima dele
      if(this.board && !TaskModal.isOpen) this.board.render();
      this.board = null;
      this.options = null;
      if(onClose) onClose();
    },

    setError(msg){ this.el.error.textContent = msg; },

    render(){
      const self = this, board = this.board, list = this.el.list;
      list.innerHTML = "";
      if(board.groups.length === 0){
        const empty = document.createElement("p");
        empty.className = "requests-empty-hint";
        empty.textContent = "Nenhum grupo criado ainda. Digite o nome do primeiro grupo abaixo.";
        list.appendChild(empty);
        return;
      }
      board.groups.forEach(function(g){
        const count = board.groupTaskCount(g.id);
        const colorBtn = h("button", {
          className:"group-color-btn", type:"button", title:"Escolher cor",
          attrs:{ "aria-label":"Escolher cor do grupo", "aria-haspopup":"dialog" },
          style:{ background:board.groupColor(g) },
          on:{ click:function(){
            ColorPicker.open(colorBtn, g.color, function(color){
              board.setGroupColor(g.id, color);
              colorBtn.style.background = board.groupColor(g);
            });
          } }
        });
        const input = h("input", {
          className:"section-editor-name", type:"text", maxLength:GROUP_NAME_MAX, value:g.name,
          attrs:{ "aria-label":"Nome do grupo" },
          on:{
            keydown:function(e){
              if(e.key === "Enter"){ e.preventDefault(); input.blur(); }
              if(e.key === "Escape"){ input.value = g.name; }
            },
            change:function(){
              const name = input.value.trim();
              const error = board.validateGroupName(name, g.id);
              if(error){ self.setError(error); input.value = g.name; return; }
              self.setError("");
              board.renameGroup(g.id, name);
              input.value = name;
            }
          }
        });
        const removeGroup = function(){
          const msg = count
            ? 'Excluir o grupo "' + g.name + '"? ' + (count === 1 ? "A tarefa dele ficará" : "As " + count + " tarefas dele ficarão") + ' sem grupo (nenhuma tarefa é apagada).'
            : 'Excluir o grupo "' + g.name + '"?';
          if(!confirm(msg)) return;
          board.deleteGroup(g.id);
          self.setError("");
          self.render();
        };
        list.appendChild(h("div", { className:"section-editor-row" }, [
          colorBtn,
          input,
          h("span", { className:"section-editor-stats", text:count === 1 ? "1 tarefa" : count + " tarefas" }),
          h("button", { className:"icon-btn danger", type:"button", title:"Excluir grupo", attrs:{ "aria-label":"Excluir grupo" },
            text:"✕", on:{ click:removeGroup } })
        ]));
      });
    },

    add(){
      const name = this.el.newInput.value.trim();
      const error = this.board.validateGroupName(name);
      if(error){ this.setError(error); this.el.newInput.focus(); return; }
      const group = this.board.addGroup(name);
      if(this.options && this.options.onCreate) this.options.onCreate(group);
      this.setError("");
      this.el.newInput.value = "";
      this.render();
      this.el.newInput.focus();
    }
  };

  Object.assign(GE, { GroupEditor });
})(window.GE = window.GE || {});
