/**
 * Exportação em PDF por meio da impressão do navegador, sem alterar a tela visível.
 */
(function (GE) {
  "use strict";
  const { Util } = GE;

  /* ============================================================ */
  /* ---------- PrintService: exportação em PDF ---------- */
  /* ---------- Usa uma área de impressão (#printRoot) que fica sempre no  */
  /* ---------- documento mas é invisível na tela; a impressão nativa do   */
  /* ---------- navegador (window.print) mostra só essa área. A tela      */
  /* ---------- visível nunca é alterada. ---------- */
  /* ============================================================ */
  const PrintService = {
    PX_PER_MM: 96 / 25.4,
    MARGIN_MM: 10,
    root: document.getElementById("printRoot"),

    printAreaPx(orientation){
      const pageW = orientation === "landscape" ? 297 : 210;
      const pageH = orientation === "landscape" ? 210 : 297;
      return {
        width: (pageW - this.MARGIN_MM * 2) * this.PX_PER_MM,
        height: (pageH - this.MARGIN_MM * 2) * this.PX_PER_MM
      };
    },

    // Folha de estilo criada em código (CSSOM): define o tamanho e a orientação da
    // página sem usar <style> embutido, que a política de segurança da página bloqueia.
    pageSheet: null,
    setOrientation(orientation){
      if(!this.pageSheet){
        this.pageSheet = new CSSStyleSheet();
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat(this.pageSheet);
      }
      this.pageSheet.replaceSync("@page{ size:A4 " + (orientation === "landscape" ? "landscape" : "portrait") + "; margin:" + this.MARGIN_MM + "mm; }");
    },

    // Clona uma tela, remove controles de edição e carimba data/hora.
    buildClone(viewEl, stampText, postProcess){
      const clone = viewEl.cloneNode(true);
      clone.removeAttribute("hidden");
      clone.querySelectorAll(".no-print, .add-task-btn, .add-column, .column-menu-btn, .entity-remove-btn, .request-remove, .requests-add")
        .forEach(function(el){ el.remove(); });
      const stampEl = clone.querySelector(".js-print-stamp");
      if(stampEl){
        stampEl.style.display = "block";
        stampEl.textContent = stampText + " · Exportado em " + Util.formatNow();
      }
      clone.querySelectorAll(".column").forEach(function(el){ el.style.maxHeight = "none"; });
      clone.querySelectorAll(".column-body").forEach(function(el){ el.style.overflow = "visible"; });
      clone.querySelectorAll(".calendar-scroll").forEach(function(el){ el.style.overflow = "visible"; });
      if(postProcess) postProcess(clone);
      return clone;
    },

    printNode(node, orientation, measureFn){
      this.setOrientation(orientation);
      this.root.innerHTML = "";
      this.root.appendChild(node);
      const area = this.printAreaPx(orientation);
      const size = measureFn ? measureFn(node) : { width: node.scrollWidth, height: node.scrollHeight };
      const scale = (size.width > 0 && size.height > 0)
        ? Math.min(area.width / size.width, area.height / size.height, 1)
        : 1;
      node.style.zoom = scale;
      window.print();
    },

    exportView(viewEl, orientation, stampText, measureFn, postProcess){
      try{
        const clone = this.buildClone(viewEl, stampText, postProcess);
        this.printNode(clone, orientation, measureFn);
      }catch(err){
        console.error("Falha ao gerar o PDF:", err);
        alert("Não foi possível gerar o PDF. Tente novamente ou use Ctrl+P / Cmd+P nesta página.");
        this.root.innerHTML = "";
      }
    }
  };
  window.addEventListener("afterprint", function(){ PrintService.root.innerHTML = ""; });

  Object.assign(GE, { PrintService });
})(window.GE = window.GE || {});
