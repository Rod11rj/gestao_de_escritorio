/**
 * Inicialização: proteções de edição, janelas compartilhadas, tema e aplicação.
 * É o último script carregado; todos os componentes já estão em window.GE.
 */
(function (GE) {
  "use strict";
  const { ActivityModal, App, ColorPicker, GroupEditor, Migration, PREFS_KEY, Preferences, SectionEditor, TaskModal, ThemeToggle } = GE;

  /** Insere texto simples na posição do cursor, substituindo a seleção. */
  function insertPlainText(text){
    const sel = window.getSelection();
    if(!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* Campos editáveis no próprio lugar (título de coluna, entidade, solicitação…)
     aceitam só texto: colar insere texto simples e soltar conteúdo arrastado é ignorado. */
  document.addEventListener("paste", function(e){
    const target = e.target && e.target.closest && e.target.closest('[contenteditable="true"]');
    if(!target) return;
    e.preventDefault();
    const text = ((e.clipboardData && e.clipboardData.getData("text/plain")) || "").replace(/\s+/g, " ");
    insertPlainText(text);
  });
  document.addEventListener("drop", function(e){
    if(e.target && e.target.closest && e.target.closest('[contenteditable="true"]')) e.preventDefault();
  }, true);

  TaskModal.init();
  ActivityModal.init();
  SectionEditor.init();
  GroupEditor.init();
  ColorPicker.init();
  /* ============================================================ */
  /* ---------- Inicialização ---------- */
  /* ============================================================ */
  ThemeToggle.init();
  GE.app = new App(); // acessível no console do navegador como GE.app
  // Dados e preferências já gravados no formato novo: remove o que só servia ao login.
  if(!localStorage.getItem(PREFS_KEY)) Preferences.update({});
  Migration.cleanup();
})(window.GE = window.GE || {});
