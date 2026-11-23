/**
 * Construção de elementos da interface sem montar HTML como texto.
 *
 * Todo conteúdo vindo do usuário entra como texto (textContent) e cores entram
 * como propriedades de estilo — nunca como HTML ou atributo "style". Isso evita
 * injeção de código e é compatível com a política de segurança (CSP) da página.
 */
(function (GE) {
  "use strict";

  /**
   * Cria um elemento.
   * @param {string} tag      nome da tag ("div", "button"…)
   * @param {object} [props]  propriedades:
   *   text       → textContent
   *   className  → classes
   *   dataset    → { chave: valor } em data-*
   *   attrs      → atributos (ex.: { "aria-label": "Excluir" })
   *   style      → propriedades CSS (ex.: { "--g": "#1F5FAD", background: "#fff" })
   *   on         → eventos (ex.: { click: fn })
   *   demais     → propriedades do DOM (type, value, checked, title, disabled, draggable…)
   *   Valores null, undefined ou false são ignorados.
   * @param {Array|Node|string} [children] filhos (textos viram nós de texto)
   * @returns {HTMLElement}
   */
  function h(tag, props, children){
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(function([key, value]){
      if(value === undefined || value === null || value === false) return;
      switch(key){
        case "text": el.textContent = value; break;
        case "className": el.className = value; break;
        case "dataset": Object.assign(el.dataset, value); break;
        case "attrs": Object.entries(value).forEach(function([a, v]){ el.setAttribute(a, v); }); break;
        case "style": Object.entries(value).forEach(function([p, v]){ el.style.setProperty(p, v); }); break;
        case "on": Object.entries(value).forEach(function([ev, fn]){ el.addEventListener(ev, fn); }); break;
        default: el[key] = value;
      }
    });
    append(el, children);
    return el;
  }

  function append(parent, children){
    if(children === undefined || children === null || children === false) return;
    (Array.isArray(children) ? children : [children]).forEach(function(child){
      if(Array.isArray(child)) append(parent, child);
      else if(child instanceof Node) parent.appendChild(child);
      else if(child !== null && child !== undefined && child !== false) parent.appendChild(document.createTextNode(String(child)));
    });
  }

  /** Torna um elemento editável no próprio lugar: Enter confirma e o texto é salvo ao sair. */
  function inlineEditable(el, onCommit){
    el.contentEditable = "true";
    el.spellcheck = false;
    el.addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); el.blur(); }
    });
    el.addEventListener("blur", function(){ onCommit(el.textContent.trim()); });
    return el;
  }

  GE.Dom = { h: h, append: append, inlineEditable: inlineEditable };
})(window.GE = window.GE || {});
