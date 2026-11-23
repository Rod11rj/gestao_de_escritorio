/**
 * Submódulo "Calendário": atividades por entidade e solicitações em aberto.
 */
(function (GE) {
  "use strict";
  const { ENTITY_PALETTE, ENTITY_PALETTE_HEX, MONTH_NAMES, PrintService, SectionModule, Util, WEEKDAY_SHORT, hasOwn } = GE;
  const { h, inlineEditable } = GE.Dom;

  /* ============================================================ */
  /* ---------- ActivityCalendar (submódulo "Calendário") ---------- */
  /* ============================================================ */
  class ActivityCalendar extends SectionModule {
    constructor(section){
      super(section, "tplCalendar", "calendar");
      this.today = new Date();
      this.viewYear = this.today.getFullYear();
      this.viewMonth = this.today.getMonth(); // 0-indexed
      this.renderedMonths = [];
      this.scrollEl = this.$(".calendar-scroll");
      this.tableEl = this.$(".calendar-table");
      this.requestsListEl = this.$(".requests-list");
      this.newRequestInput = this.$(".js-new-request");
      this.bindToolbar();
    }

    bindToolbar(){
      this.on(".js-prev", "click", function(){
        this.viewMonth--;
        if(this.viewMonth < 0){ this.viewMonth = 11; this.viewYear--; }
        this.renderCalendar(true);
      });
      this.on(".js-next", "click", function(){
        this.viewMonth++;
        if(this.viewMonth > 11){ this.viewMonth = 0; this.viewYear++; }
        this.renderCalendar(true);
      });
      this.on(".js-today", "click", function(){
        this.goToToday();
        this.renderCalendar(true);
      });
      this.on(".js-add-entity", "click", this.addEntity);
      this.on(".js-add-activity", "click", function(){ GE.ActivityModal.open(this, null); });
      this.on(".js-clear-month", "click", this.clearMonth);
      this.on(".js-add-request", "click", this.addRequest);
      this.newRequestInput.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){ e.preventDefault(); this.addRequest(); }
      });
      this.on(".js-export-pdf", "click", this.exportPdf);

      this.scrollEl.addEventListener("scroll", () => {
        const el = this.scrollEl;
        if(el.scrollWidth - el.scrollLeft - el.clientWidth < 400) this.extendWithNextMonth();
      });
      // Rolagem feita pelo usuário (e não pelo posicionamento automático em "hoje").
      ["wheel", "touchstart", "pointerdown", "keydown"].forEach((type) => {
        this.scrollEl.addEventListener(type, () => { this.userScrolled = true; }, { passive:true });
      });
    }

    // Atualiza "hoje" (o sistema pode ter ficado aberto de um dia para o outro)
    // e volta a exibição para o mês atual.
    goToToday(){
      this.today = new Date();
      this.viewYear = this.today.getFullYear();
      this.viewMonth = this.today.getMonth();
    }

    // Ao abrir o calendário, ele sempre começa no dia de hoje.
    onShow(){
      this.goToToday();
      this.render(true);
    }
    render(resetScroll){
      this.renderCalendar(resetScroll);
      this.renderRequests();
    }

    ensureEntityColors(){
      this.data.entities.forEach(function(ent, idx){
        if(!ent.color) ent.color = ENTITY_PALETTE[idx % ENTITY_PALETTE.length];
      });
    }

    isToday(year, month, day){
      return year === this.today.getFullYear() && month === this.today.getMonth() && day === this.today.getDate();
    }

    activitiesFor(entityId, key){
      return this.data.activities.filter(function(a){
        return a.entityId === entityId && a.days.indexOf(key) !== -1;
      });
    }

    buildDayHeaderCell(year, month, day, isMonthStart){
      const dow = new Date(year, month, day).getDay();
      return h("th", {
        className:"day-header" + ((dow === 0 || dow === 6) ? " weekend" : "") +
          (this.isToday(year, month, day) ? " today" : "") + (isMonthStart ? " month-start" : "")
      }, [
        isMonthStart ? h("span", { className:"month-tag", text:MONTH_NAMES[month].slice(0, 3) }) : null,
        h("span", { className:"dow", text:WEEKDAY_SHORT[dow] }),
        h("span", { className:"dom", text:day })
      ]);
    }

    buildDayCell(ent, year, month, day, isMonthStart){
      const key = Util.dateKey(year, month, day);
      const dow = new Date(year, month, day).getDay();
      const td = document.createElement("td");
      td.className = "day-cell" + ((dow === 0 || dow === 6) ? " weekend" : "") +
        (this.isToday(year, month, day) ? " today" : "") + (isMonthStart ? " month-start" : "");

      this.activitiesFor(ent.id, key).forEach((act) => {
        const chip = document.createElement("button");
        chip.className = "activity-chip";
        chip.type = "button";
        chip.textContent = act.title || "Sem título";
        chip.style.background = ENTITY_PALETTE_HEX[ent.color];
        chip.title = act.title;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          GE.ActivityModal.open(this, act.id);
        });
        td.appendChild(chip);
      });

      td.addEventListener("click", () => GE.ActivityModal.open(this, null, ent.id, key));
      return td;
    }

    buildEntityNameCell(ent){
      const color = hasOwn(ENTITY_PALETTE_HEX, ent.color) ? ENTITY_PALETTE_HEX[ent.color] : ENTITY_PALETTE_HEX.slate;
      const nameEl = inlineEditable(h("span", { className:"entity-name", text:ent.name }), (text) => {
        ent.name = text || "Sem nome";
        nameEl.textContent = ent.name;
        this.save();
      });
      return h("td", { className:"entity-name-cell" },
        h("div", { className:"entity-name-inner" }, [
          h("span", { className:"entity-color-dot", style:{ background:color } }),
          nameEl,
          h("button", { className:"entity-remove-btn", type:"button", title:"Remover entidade", attrs:{ "aria-label":"Remover entidade" }, text:"✕",
            on:{ click:() => this.removeEntity(ent.id) } })
        ]));
    }

    // resetScroll = true: abertura do submódulo ou troca de mês (posiciona em "hoje" ou no dia 1).
    // resetScroll = false: redesenho após edição (mantém a posição de rolagem atual).
    renderCalendar(resetScroll){
      const keepScroll = (!resetScroll && this.renderedMonths.length) ? this.scrollEl.scrollLeft : null;
      const keepMonths = this.renderedMonths.length;
      this.ensureEntityColors();

      const label = MONTH_NAMES[this.viewMonth] + " de " + this.viewYear;
      this.$(".js-month-label").textContent = label;
      this.$(".js-month-label-print").textContent = label;

      this.renderedMonths = [{ year:this.viewYear, month:this.viewMonth }];
      const total = Util.daysInMonth(this.viewYear, this.viewMonth);
      const table = this.tableEl;
      table.innerHTML = "";

      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      const cornerTh = document.createElement("th");
      cornerTh.className = "entity-col-header";
      cornerTh.textContent = "Entidade";
      headRow.appendChild(cornerTh);
      for(let d = 1; d <= total; d++){
        headRow.appendChild(this.buildDayHeaderCell(this.viewYear, this.viewMonth, d, false));
      }
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      if(this.data.entities.length === 0){
        const emptyRow = document.createElement("tr");
        emptyRow.className = "no-entities-row";
        const emptyTd = document.createElement("td");
        emptyTd.colSpan = total + 1;
        emptyTd.textContent = 'Nenhuma entidade cadastrada ainda. Use "+ Nova entidade" para começar.';
        emptyRow.appendChild(emptyTd);
        tbody.appendChild(emptyRow);
      }else{
        this.data.entities.forEach((ent) => {
          const tr = document.createElement("tr");
          tr.appendChild(this.buildEntityNameCell(ent));
          for(let d = 1; d <= total; d++){
            tr.appendChild(this.buildDayCell(ent, this.viewYear, this.viewMonth, d, false));
          }
          tbody.appendChild(tr);
        });
      }
      table.appendChild(tbody);

      if(keepScroll !== null){
        while(this.renderedMonths.length < keepMonths && this.renderedMonths.length < 6) this.extendWithNextMonth();
        this.scrollEl.scrollLeft = keepScroll;
        return;
      }

      this.scrollEl.scrollLeft = 0;
      this.userScrolled = false;
      // No mês atual, o primeiro dia exibido é o dia de hoje.
      if(this.viewYear === this.today.getFullYear() && this.viewMonth === this.today.getMonth()){
        this.extendWithNextMonth(); // garante dias à frente para o "hoje" poder ficar no início
        this.pinToday();
      }
    }

    // Posiciona "hoje" logo após a coluna de entidades. Reaplica depois que a
    // página termina de desenhar e as fontes carregam (podem mudar as medidas),
    // a menos que o usuário já tenha rolado o calendário.
    pinToday(){
      const index = this.today.getDate() - 1;
      const apply = () => {
        if(this.userScrolled || !this.isVisible) return;
        if(this.viewYear !== this.today.getFullYear() || this.viewMonth !== this.today.getMonth()) return;
        this.scrollToDayIndex(index);
      };
      apply();
      requestAnimationFrame(apply);
      if(document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
    }

    scrollToDayIndex(index){
      const headers = this.$$("thead th.day-header");
      const corner = this.$("thead th.entity-col-header");
      if(!headers[index]) return;
      this.scrollEl.scrollLeft = headers[index].offsetLeft - (corner ? corner.offsetWidth : 0);
    }

    extendWithNextMonth(){
      if(this.renderedMonths.length >= 6) return; // limite de segurança para não crescer sem fim
      const last = this.renderedMonths[this.renderedMonths.length - 1];
      let nextMonth = last.month + 1, nextYear = last.year;
      if(nextMonth > 11){ nextMonth = 0; nextYear++; }
      this.renderedMonths.push({ year:nextYear, month:nextMonth });

      const headRow = this.tableEl.querySelector("thead tr");
      const totalDays = Util.daysInMonth(nextYear, nextMonth);
      for(let d = 1; d <= totalDays; d++){
        headRow.appendChild(this.buildDayHeaderCell(nextYear, nextMonth, d, d === 1));
      }

      if(this.data.entities.length === 0){
        const emptyTd = this.tableEl.querySelector(".no-entities-row td");
        if(emptyTd) emptyTd.colSpan = Number(emptyTd.colSpan) + totalDays;
      }else{
        this.tableEl.querySelectorAll("tbody tr:not(.no-entities-row)").forEach((tr, idx) => {
          const ent = this.data.entities[idx];
          if(!ent) return;
          for(let d = 1; d <= totalDays; d++){
            tr.appendChild(this.buildDayCell(ent, nextYear, nextMonth, d, d === 1));
          }
        });
      }
    }

    /* ---------- Entidades ---------- */
    addEntity(){
      this.data.entities.push({ id:Util.uid("ent"), name:"Nova entidade", color:"" });
      this.ensureEntityColors();
      this.save();
      this.renderCalendar(false);
      const names = this.$$(".entity-name");
      if(names.length) Util.selectContents(names[names.length - 1]);
    }

    removeEntity(entId){
      const ent = this.data.entities.find(function(e){ return e.id === entId; });
      if(!ent) return;
      if(!confirm('Remover a entidade "' + ent.name + '" e todas as atividades associadas a ela?')) return;
      this.data.entities = this.data.entities.filter(function(e){ return e.id !== entId; });
      this.data.activities = this.data.activities.filter(function(a){ return a.entityId !== entId; });
      this.save();
      this.renderCalendar(false);
    }

    clearMonth(){
      const label = MONTH_NAMES[this.viewMonth] + " de " + this.viewYear;
      const monthPrefix = this.viewYear + "-" + String(this.viewMonth + 1).padStart(2,"0");
      const count = this.data.activities.filter(function(a){
        return a.days.some(function(k){ return k.indexOf(monthPrefix) === 0; });
      }).length;
      if(count === 0){ alert("Não há atividades registradas em " + label + "."); return; }
      if(!confirm('Apagar os dados de "' + label + '"? Isso remove os dias desse mês de todas as atividades (e a atividade inteira, se ela só tinha dias nesse mês). Essa ação não pode ser desfeita.')) return;
      this.data.activities.forEach(function(a){
        a.days = a.days.filter(function(k){ return k.indexOf(monthPrefix) !== 0; });
      });
      this.data.activities = this.data.activities.filter(function(a){ return a.days.length > 0; });
      this.save();
      this.renderCalendar(false);
    }

    /* ---------- Solicitações em aberto ---------- */
    renderRequests(){
      const list = this.requestsListEl;
      list.innerHTML = "";
      const requests = this.data.requests;
      if(requests.length === 0){
        const hint = document.createElement("p");
        hint.className = "requests-empty-hint";
        hint.textContent = "Nenhuma solicitação em aberto no momento.";
        list.appendChild(hint);
        return;
      }
      requests.forEach((req) => { list.appendChild(this.renderRequestRow(req)); });
    }

    renderRequestRow(req){
      const removeRequest = () => {
        this.data.requests = this.data.requests.filter(function(r){ return r.id !== req.id; });
        this.save();
        this.renderRequests();
      };
      const row = h("div", { className:"request-row" + (req.resolved ? " resolved" : "") }, [
        h("label", { className:"request-check" }, [
          h("input", { type:"checkbox", checked:req.resolved, on:{ change:(e) => {
            req.resolved = e.target.checked;
            row.classList.toggle("resolved", req.resolved);
            this.save();
          } } }),
          "Atendida"
        ]),
        inlineEditable(h("span", { className:"request-text", text:req.text }), (text) => {
          req.text = text;
          if(!req.text){ removeRequest(); return; }
          this.save();
        }),
        h("button", { className:"request-remove", type:"button", title:"Remover", attrs:{ "aria-label":"Remover solicitação" }, text:"✕",
          on:{ click:removeRequest } })
      ]);
      return row;
    }

    addRequest(){
      const text = this.newRequestInput.value.trim();
      if(!text) return;
      this.data.requests.push({ id:Util.uid("req"), text:text, resolved:false, createdAt:Date.now() });
      this.newRequestInput.value = "";
      this.save();
      this.renderRequests();
      this.newRequestInput.focus();
    }

    /* ---------- PDF ---------- */
    firstVisibleDayIndex(){
      const corner = this.$("thead th.entity-col-header");
      const stickyRight = corner ? corner.getBoundingClientRect().right : this.scrollEl.getBoundingClientRect().left;
      const headers = this.$$("thead th.day-header");
      for(let i = 0; i < headers.length; i++){
        if(headers[i].getBoundingClientRect().right > stickyRight + 1) return i;
      }
      return 0;
    }

    dateAtColumnIndex(index){
      let remaining = index;
      for(let m = 0; m < this.renderedMonths.length; m++){
        const rm = this.renderedMonths[m];
        const dim = Util.daysInMonth(rm.year, rm.month);
        if(remaining < dim) return { year:rm.year, month:rm.month, day:remaining + 1 };
        remaining -= dim;
      }
      const last = this.renderedMonths[this.renderedMonths.length - 1] || { year:this.viewYear, month:this.viewMonth };
      return { year:last.year, month:last.month, day:Util.daysInMonth(last.year, last.month) };
    }

    exportPdf(){
      const startIndex = this.firstVisibleDayIndex();
      const startDate = this.dateAtColumnIndex(startIndex);
      const windowSize = Util.daysInMonth(this.viewYear, this.viewMonth);
      const stamp = this.section.name + " · Calendário de atividades · a partir de " +
        startDate.day + " de " + MONTH_NAMES[startDate.month] + " de " + startDate.year;

      PrintService.exportView(this.root, "landscape", stamp,
        function measure(root){
          return { width: root.querySelector(".calendar-table").scrollWidth + 24, height: root.scrollHeight };
        },
        function trimToVisibleWindow(clone){
          const table = clone.querySelector(".calendar-table");
          const totalDayCols = table.querySelector("thead tr").children.length - 1;
          const start = Math.min(Math.max(startIndex, 0), Math.max(totalDayCols - 1, 0));
          const end = Math.min(start + windowSize, totalDayCols);
          table.querySelectorAll("tr").forEach(function(tr){
            const children = Array.from(tr.children);
            for(let i = 1; i < children.length; i++){
              const dayIdx = i - 1;
              if(dayIdx < start || dayIdx >= end) tr.removeChild(children[i]);
            }
          });
        });
    }
  }

  Object.assign(GE, { ActivityCalendar });
})(window.GE = window.GE || {});
