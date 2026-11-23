/**
 * Janela de atividade do calendário.
 */
(function (GE) {
  "use strict";
  const { MONTH_NAMES, Util } = GE;
  const { h } = GE.Dom;

  /* ============================================================ */
  /* ---------- ActivityModal: janela de atividade (compartilhada) ---------- */
  /* ============================================================ */
  const ActivityModal = {
    calendar: null,
    activityId: null,
    el: {
      overlay: document.getElementById("activityModalOverlay"),
      title: document.getElementById("activityTitleInput"),
      entity: document.getElementById("activityEntity"),
      dayPicker: document.getElementById("activityDayPicker"),
      meta: document.getElementById("activityMetaNote"),
      deleteBtn: document.getElementById("deleteActivityBtn")
    },

    get data(){ return this.calendar.data; },
    get isOpen(){ return this.el.overlay.classList.contains("open"); },

    init(){
      const self = this, el = this.el;
      el.title.addEventListener("input", function(){ self.persist(); });
      el.entity.addEventListener("change", function(){ self.persist(); });
      el.deleteBtn.addEventListener("click", function(){
        if(!self.activityId){ self.close(); return; }
        if(!confirm("Excluir esta atividade?")) return;
        const id = self.activityId;
        self.data.activities = self.data.activities.filter(function(a){ return a.id !== id; });
        self.activityId = null;
        self.calendar.save();
        self.close();
      });
      document.getElementById("closeActivityModalBtn").addEventListener("click", function(){ self.close(); });
      el.overlay.addEventListener("click", function(e){ if(e.target === el.overlay) self.close(); });
      document.addEventListener("keydown", function(e){ if(e.key === "Escape" && self.isOpen) self.close(); });
    },

    open(calendar, activityId, presetEntityId, presetDayKey){
      if(calendar.data.entities.length === 0){
        alert('Cadastre uma entidade primeiro, usando "+ Nova entidade".');
        return;
      }
      this.calendar = calendar;
      this.activityId = activityId;
      const el = this.el, data = this.data;
      const activity = activityId ? data.activities.find(function(a){ return a.id === activityId; }) : null;

      el.entity.innerHTML = "";
      data.entities.forEach(function(ent){
        const opt = document.createElement("option");
        opt.value = ent.id;
        opt.textContent = ent.name;
        el.entity.appendChild(opt);
      });

      let selectedDays, ref;
      if(activity){
        el.title.value = activity.title;
        el.entity.value = activity.entityId;
        selectedDays = activity.days.slice();
        ref = activity.days[0] ? activity.days[0].split("-") : null;
        el.meta.textContent = calendar.section.name + " · Atividade existente";
        el.deleteBtn.style.display = "";
      }else{
        el.title.value = "";
        el.entity.value = presetEntityId || data.entities[0].id;
        selectedDays = presetDayKey ? [presetDayKey] : [];
        ref = presetDayKey ? presetDayKey.split("-") : null;
        el.deleteBtn.style.display = "none";
      }
      const pickerYear = ref ? Number(ref[0]) : calendar.viewYear;
      const pickerMonth = ref ? Number(ref[1]) - 1 : calendar.viewMonth;
      if(!activity) el.meta.textContent = calendar.section.name + " · Nova atividade — " + MONTH_NAMES[pickerMonth] + " de " + pickerYear;

      this.renderDayPicker(selectedDays, pickerYear, pickerMonth);
      el.overlay.classList.add("open");
      el.title.focus();
    },

    renderDayPicker(selectedDays, year, month){
      const self = this, picker = this.el.dayPicker;
      picker.innerHTML = "";
      const total = Util.daysInMonth(year, month);
      for(let d = 1; d <= total; d++){
        const key = Util.dateKey(year, month, d);
        const checked = selectedDays.indexOf(key) !== -1;
        const label = h("label", { className:checked ? "checked" : "" }, [
          h("input", { type:"checkbox", value:key, checked:checked, on:{ change:function(){
            label.classList.toggle("checked", this.checked);
            self.persist();
          } } }),
          d
        ]);
        picker.appendChild(label);
      }
    },

    selectedDays(){
      return Array.from(this.el.dayPicker.querySelectorAll('input[type="checkbox"]:checked')).map(function(cb){ return cb.value; });
    },

    persist(){
      const data = this.data;
      const title = this.el.title.value.trim();
      const entityId = this.el.entity.value;
      const days = this.selectedDays();
      const id = this.activityId;

      if(days.length === 0){
        if(id){
          data.activities = data.activities.filter(function(a){ return a.id !== id; });
          this.activityId = null;
        }
        this.calendar.save();
        return;
      }
      if(!id){
        this.activityId = Util.uid("act");
        data.activities.push({ id:this.activityId, entityId:entityId, title:title, days:days });
      }else{
        const activity = data.activities.find(function(a){ return a.id === id; });
        if(activity){
          activity.title = title;
          activity.entityId = entityId;
          activity.days = days;
        }
      }
      this.calendar.save();
    },

    close(){
      const calendar = this.calendar;
      if(!calendar) { this.el.overlay.classList.remove("open"); return; }
      // Descarta atividade sem título ou sem dias
      const id = this.activityId;
      if(id){
        const activity = this.data.activities.find(function(a){ return a.id === id; });
        if(activity && (activity.days.length === 0 || !activity.title.trim())){
          this.data.activities = this.data.activities.filter(function(a){ return a.id !== id; });
          calendar.save();
        }
      }
      this.activityId = null;
      this.calendar = null;
      this.el.overlay.classList.remove("open");
      calendar.renderCalendar(false);
    }
  };

  Object.assign(GE, { ActivityModal });
})(window.GE = window.GE || {});
