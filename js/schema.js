/**
 * Schema: formato dos dados do sistema.
 *
 *   { version: 3,
 *     sectionList: [ { id, name } ],                 // ordem da barra lateral
 *     sections: { <id>: { kanban, calendar } } }
 *
 *   kanban   = { boardTitle, columns:[{ id, title, taskIds }], tasks:{ <id>: tarefa }, groups:[{ id, name, color }] }
 *   calendar = { entities:[{ id, name, color }], activities:[{ id, entityId, title, days:["AAAA-MM-DD"] }],
 *                requests:[{ id, text, resolved }] }
 *
 * Contém os valores padrão, a conversão do formato mais antigo e o saneamento:
 * todo dado lido do navegador ou de um backup importado é reconstruído campo a campo
 * (tipos conferidos, textos limitados, identificadores seguros, datas e cores validadas).
 * Nada do arquivo original é reaproveitado sem conferência.
 */
(function (GE) {
  "use strict";
  const { DATE_RE, DEFAULT_SECTIONS, ENTITY_PALETTE, GROUP_NAME_MAX, GROUP_PALETTE, GROUP_PALETTE_HEX, HEX_COLOR_RE, LEGACY_GROUPS, PRIORITY_LABEL, SECTION_NAME_MAX, Util, hasOwn, isObj } = GE;

  class Schema {
    static emptyKanban(){
      return {
        boardTitle:"Quadro da Equipe",
        columns:[
          { id:Util.uid("col"), title:"A Fazer", taskIds:[] },
          { id:Util.uid("col"), title:"Fazendo", taskIds:[] },
          { id:Util.uid("col"), title:"Feito", taskIds:[] }
        ],
        tasks:{},
        groups:[]   // grupos de tarefas definidos pelo usuário: { id, name, color }
      };
    }

    // Garante a lista de grupos do quadro. Tarefas da época dos grupos fixos
    // (adestramento/planejamento) ganham grupos editáveis equivalentes.
    static normalizeGroups(kanban){
      if(!Array.isArray(kanban.groups)) kanban.groups = [];
      const known = {};
      kanban.groups.forEach(function(g){ known[g.id] = true; });
      Object.values(kanban.tasks).forEach(function(task){
        const gid = task.group;
        if(!gid){ task.group = ""; return; }
        if(known[gid]) return;
        const legacy = LEGACY_GROUPS[gid];
        kanban.groups.push({
          id: gid,
          name: legacy ? legacy.name : String(gid).slice(0, GROUP_NAME_MAX),
          color: legacy ? legacy.color : GROUP_PALETTE[kanban.groups.length % GROUP_PALETTE.length]
        });
        known[gid] = true;
      });
    }

    static emptyCalendar(){
      return { entities:[], activities:[], requests:[] };
    }

    static fromLegacy(v1){
      return {
        kanban:{ boardTitle:v1.boardTitle, columns:v1.columns, tasks:v1.tasks, groups:[] },
        calendar: v1.planning
      };
    }

    static isLegacy(obj){ return isObj(obj) && Array.isArray(obj.columns) && isObj(obj.tasks) && !obj.sections; }

    /* ---------- Saneamento ---------- */
    /* Todo dado lido (do navegador ou de um backup importado) passa por aqui e é
       reconstruído campo a campo: tipos conferidos, textos limitados, ids seguros,
       datas e cores validadas. Nada do arquivo original é reaproveitado sem conferência. */
    static sanitize(raw){
      const src = isObj(raw) ? raw : {};
      const srcSections = isObj(src.sections) ? src.sections : {};
      // Dados da versão 2 não tinham lista editável: usa as seções padrão.
      const list = Array.isArray(src.sectionList) ? src.sectionList
        : DEFAULT_SECTIONS.map(function(d){ return { id:d.id, name:d.name }; });
      const out = { version:3, sectionList:[], sections:{} };
      list.forEach(function(d){
        if(!isObj(d) || !Util.isSafeId(d.id) || hasOwn(out.sections, d.id)) return;
        out.sectionList.push({ id:d.id, name:Util.str(d.name, SECTION_NAME_MAX).trim() || "Sem nome" });
        const sec = hasOwn(srcSections, d.id) && isObj(srcSections[d.id]) ? srcSections[d.id] : {};
        out.sections[d.id] = { kanban:Schema.sanitizeKanban(sec.kanban), calendar:Schema.sanitizeCalendar(sec.calendar) };
      });
      return out;
    }

    static safeGroupColor(c, idx){
      if(typeof c === "string" && (hasOwn(GROUP_PALETTE_HEX, c) || HEX_COLOR_RE.test(c))) return c;
      return GROUP_PALETTE[idx % GROUP_PALETTE.length];
    }

    static sanitizeKanban(k){
      if(!isObj(k)) return Schema.emptyKanban();
      const tasks = {};
      const srcTasks = isObj(k.tasks) ? k.tasks : {};
      Object.keys(srcTasks).forEach(function(id){
        const t = srcTasks[id];
        if(!Util.isSafeId(id) || !isObj(t)) return;
        tasks[id] = {
          id: id,
          title: Util.str(t.title, 300),
          group: Util.isSafeId(t.group) ? t.group : "",
          responsavel: Util.str(t.responsavel, 120),
          priority: (typeof t.priority === "string" && hasOwn(PRIORITY_LABEL, t.priority)) ? t.priority : "media",
          prazo: (typeof t.prazo === "string" && DATE_RE.test(t.prazo)) ? t.prazo : "",
          referencia: Util.str(t.referencia, 300),
          descricao: Util.str(t.descricao, 20000),
          checklist: (Array.isArray(t.checklist) ? t.checklist : []).filter(isObj).slice(0, 500).map(function(i){
            return { id:Util.isSafeId(i.id) ? i.id : Util.uid("chk"), text:Util.str(i.text, 500), done:i.done === true };
          }),
          createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now()
        };
      });

      const placed = new Set(), colIds = new Set();
      const columns = (Array.isArray(k.columns) ? k.columns : []).filter(isObj).map(function(c){
        const id = (Util.isSafeId(c.id) && !colIds.has(c.id)) ? c.id : Util.uid("col");
        colIds.add(id);
        const taskIds = (Array.isArray(c.taskIds) ? c.taskIds : []).filter(function(tid){
          if(typeof tid !== "string" || !hasOwn(tasks, tid) || placed.has(tid)) return false;
          placed.add(tid);
          return true;
        });
        return { id:id, title:Util.str(c.title, 120).trim() || "Sem título", taskIds:taskIds };
      });
      // tarefas que não estavam em nenhuma coluna não se perdem: vão para a primeira
      const orphans = Object.keys(tasks).filter(function(id){ return !placed.has(id); });
      if(orphans.length){
        if(!columns.length) columns.push({ id:Util.uid("col"), title:"A Fazer", taskIds:[] });
        Array.prototype.push.apply(columns[0].taskIds, orphans);
      }

      const groups = [], groupIds = new Set();
      (Array.isArray(k.groups) ? k.groups : []).forEach(function(g){
        if(!isObj(g) || !Util.isSafeId(g.id) || groupIds.has(g.id)) return;
        groupIds.add(g.id);
        groups.push({ id:g.id, name:Util.str(g.name, GROUP_NAME_MAX).trim() || "Sem nome", color:Schema.safeGroupColor(g.color, groups.length) });
      });

      const kanban = {
        boardTitle: Util.str(k.boardTitle, 120).trim() || "Quadro da Equipe",
        columns: Array.isArray(k.columns) ? columns : Schema.emptyKanban().columns.concat(columns),
        tasks: tasks,
        groups: groups
      };
      Schema.normalizeGroups(kanban);
      return kanban;
    }

    static sanitizeCalendar(c){
      if(!isObj(c)) return Schema.emptyCalendar();
      const entities = [], entIds = new Set();
      (Array.isArray(c.entities) ? c.entities : []).forEach(function(e){
        if(!isObj(e)) return;
        const id = (Util.isSafeId(e.id) && !entIds.has(e.id)) ? e.id : Util.uid("ent");
        entIds.add(id);
        entities.push({ id:id, name:Util.str(e.name, 120).trim() || "Sem nome",
          color:(typeof e.color === "string" && ENTITY_PALETTE.indexOf(e.color) !== -1) ? e.color : "" });
      });
      const activities = [];
      (Array.isArray(c.activities) ? c.activities : []).forEach(function(a){
        if(!isObj(a) || typeof a.entityId !== "string" || !entIds.has(a.entityId)) return;
        const days = Array.from(new Set((Array.isArray(a.days) ? a.days : []).filter(function(d){
          return typeof d === "string" && DATE_RE.test(d);
        })));
        if(!days.length) return;
        activities.push({ id:Util.isSafeId(a.id) ? a.id : Util.uid("act"), entityId:a.entityId, title:Util.str(a.title, 300), days:days });
      });
      const requests = [];
      (Array.isArray(c.requests) ? c.requests : []).forEach(function(r){
        if(!isObj(r)) return;
        const text = Util.str(r.text, 1000).trim();
        if(!text) return;
        requests.push({ id:Util.isSafeId(r.id) ? r.id : Util.uid("req"), text:text, resolved:r.resolved === true,
          createdAt:Number.isFinite(r.createdAt) ? r.createdAt : Date.now() });
      });
      return { entities:entities, activities:activities, requests:requests };
    }
  }

  Object.assign(GE, { Schema });
})(window.GE = window.GE || {});
