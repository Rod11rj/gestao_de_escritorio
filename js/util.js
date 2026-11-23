/**
 * Funções utilitárias: identificadores, textos, datas, escape de HTML e validação de dados.
 */
(function (GE) {
  "use strict";
  /* ============================================================ */
  /* ---------- Utilitários ---------- */
  /* ============================================================ */
  const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
  const hasOwn = function(obj, key){ return Object.prototype.hasOwnProperty.call(obj, key); };
  const isObj = function(v){ return !!v && typeof v === "object" && !Array.isArray(v); };

  const Util = {
    // Identificadores aceitos nos dados (bloqueia "__proto__" e afins).
    isSafeId(id){
      return typeof id === "string" && id.length > 0 && id.length <= 80 &&
        /^[A-Za-z0-9_-]+$/.test(id) && !RESERVED_KEYS.has(id);
    },
    // Converte para texto com tamanho máximo.
    str(v, max){
      const t = typeof v === "string" ? v : (v === null || v === undefined || typeof v === "object") ? "" : String(v);
      return t.slice(0, max || 5000);
    },
    uid(prefix){
      return (prefix||"id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    },
    initials(name){
      name = (name||"").trim();
      if(!name) return "?";
      const parts = name.split(/\s+/);
      let s = parts[0][0];
      if(parts.length > 1) s += parts[parts.length-1][0];
      return s.toUpperCase();
    },
    dateKey(year, monthIndex, day){
      return year + "-" + String(monthIndex + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    },
    formatDate(iso){
      if(!iso) return "";
      const parts = iso.split("-");
      if(parts.length !== 3) return iso;
      return parts[2] + "/" + parts[1];
    },
    daysInMonth(year, monthIndex){
      return new Date(year, monthIndex + 1, 0).getDate();
    },
    formatNow(){
      const d = new Date();
      const pad = function(n){ return String(n).padStart(2,"0"); };
      return pad(d.getDate()) + "/" + pad(d.getMonth()+1) + "/" + d.getFullYear() + " às " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    },
    selectContents(el){
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      el.focus();
    }
  };

  Object.assign(GE, { RESERVED_KEYS, DATE_RE, HEX_COLOR_RE, hasOwn, isObj, Util });
})(window.GE = window.GE || {});
