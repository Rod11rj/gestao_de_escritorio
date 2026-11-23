/**
 * Store: persistência dos dados no navegador (localStorage) e operações sobre a lista de seções.
 * O formato e o saneamento dos dados ficam em schema.js.
 */
(function (GE) {
  "use strict";
  const { DATA_KEY, Migration, SECTION_NAME_MAX, Schema, Util, isObj } = GE;

  class Store {
    constructor(){
      this.key = DATA_KEY;
      this.data = this.load();
      this.save();
    }

    static readJson(key){
      try{
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }catch(e){
        console.error("Falha ao ler dados salvos (" + key + ").", e);
        return null;
      }
    }

    load(){
      const own = Store.readJson(this.key);
      if(isObj(own)) return Schema.sanitize(own);
      // Primeira vez nesta versão: aproveita os dados de versões anteriores, se houver;
      // senão começa sem nenhuma seção — o usuário cria as suas.
      const previous = Migration.previousData();
      return Schema.sanitize(previous ? previous.data : { sectionList:[], sections:{} });
    }

    save(){
      localStorage.setItem(this.key, JSON.stringify(this.data));
    }

    section(id){ return this.data.sections[id]; }

    /* ---------- Lista de seções (editável pelo usuário) ---------- */
    get sectionList(){ return this.data.sectionList; }

    sectionDef(id){ return this.data.sectionList.find(function(d){ return d.id === id; }); }

    // Retorna uma mensagem de erro, ou "" se o nome for válido.
    validateSectionName(name, ignoreId){
      const clean = String(name || "").trim();
      if(!clean) return "Informe um nome para a seção.";
      if(clean.length > SECTION_NAME_MAX) return "Use no máximo " + SECTION_NAME_MAX + " caracteres.";
      const lower = clean.toLocaleLowerCase("pt-BR");
      const dup = this.data.sectionList.some(function(d){
        return d.id !== ignoreId && d.name.toLocaleLowerCase("pt-BR") === lower;
      });
      return dup ? 'Já existe uma seção chamada "' + clean + '".' : "";
    }

    addSection(name){
      const def = { id:Util.uid("sec"), name:String(name).trim() };
      this.data.sectionList.push(def);
      this.data.sections[def.id] = { kanban:Schema.emptyKanban(), calendar:Schema.emptyCalendar() };
      this.save();
      return def;
    }

    renameSection(id, name){
      const def = this.sectionDef(id);
      if(!def) return;
      def.name = String(name).trim();
      this.save();
    }

    moveSection(id, delta){
      const list = this.data.sectionList;
      const from = list.findIndex(function(d){ return d.id === id; });
      const to = from + delta;
      if(from < 0 || to < 0 || to >= list.length) return;
      list.splice(to, 0, list.splice(from, 1)[0]);
      this.save();
    }

    deleteSection(id){
      this.data.sectionList = this.data.sectionList.filter(function(d){ return d.id !== id; });
      delete this.data.sections[id];
      this.save();
    }

    sectionStats(id){
      const sec = this.data.sections[id];
      return {
        tasks: Object.keys(sec.kanban.tasks).length,
        activities: sec.calendar.activities.length,
        requests: sec.calendar.requests.length,
        entities: sec.calendar.entities.length
      };
    }

    replaceAll(data){
      this.data = Schema.sanitize(data);
      this.save();
    }

    replaceSection(id, sectionData){
      const sec = isObj(sectionData) ? sectionData : {};
      this.data.sections[id] = { kanban:Schema.sanitizeKanban(sec.kanban), calendar:Schema.sanitizeCalendar(sec.calendar) };
      this.save();
    }
  }

  Object.assign(GE, { Store });
})(window.GE = window.GE || {});
