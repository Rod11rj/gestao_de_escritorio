/**
 * Migração de dados de versões anteriores (com contas de usuário ou formato antigo).
 */
(function (GE) {
  "use strict";
  const { LEGACY_ACCOUNT_PREFIX, LEGACY_AUTH_KEYS, LEGACY_SESSION_KEY, LEGACY_SHARED_KEY, LEGACY_STORAGE_KEY, LEGACY_USERS_KEY, Schema, isObj } = GE;

  /* ============================================================ */
  /* ---------- Migration: dados de versões anteriores ---------- */
  /* ---------- Versões anteriores tinham contas de usuário. Agora o sistema não  */
  /* ---------- tem login: os dados da conta usada por último (ou, se não houver, */
  /* ---------- da conta com mais conteúdo) passam a ser os dados do sistema.     */
  /* ---------- As cópias antigas por conta continuam guardadas no navegador.     */
  /* ============================================================ */
  const Migration = {
    _picked: undefined,

    readJson(key){
      try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }catch{ return null; }
    },

    accountKeys(){
      const keys = [];
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(k && k.indexOf(LEGACY_ACCOUNT_PREFIX) === 0) keys.push(k);
      }
      return keys.sort();
    },

    contentSize(data){
      if(!isObj(data) || !isObj(data.sections)) return -1;
      let n = 0;
      Object.keys(data.sections).forEach(function(id){
        const sec = data.sections[id];
        if(!isObj(sec)) return;
        if(sec.kanban && isObj(sec.kanban.tasks)) n += Object.keys(sec.kanban.tasks).length;
        if(sec.calendar && Array.isArray(sec.calendar.activities)) n += sec.calendar.activities.length;
        n += 1;
      });
      return n;
    },

    // Retorna { data, account } ou null. O resultado é memorizado.
    previousData(){
      if(this._picked !== undefined) return this._picked;
      let picked = null;
      const keys = this.accountKeys();
      if(keys.length){
        const session = localStorage.getItem(LEGACY_SESSION_KEY);
        let key = (session && keys.indexOf(LEGACY_ACCOUNT_PREFIX + session) !== -1) ? LEGACY_ACCOUNT_PREFIX + session : null;
        if(!key){
          const self = this;
          key = keys.reduce(function(best, k){
            return self.contentSize(self.readJson(k)) > self.contentSize(self.readJson(best)) ? k : best;
          }, keys[0]);
        }
        const data = this.readJson(key);
        if(isObj(data)) picked = { data:data, account:key.slice(LEGACY_ACCOUNT_PREFIX.length) };
      }
      if(!picked){
        const shared = this.readJson(LEGACY_SHARED_KEY);
        if(isObj(shared) && isObj(shared.sections)) picked = { data:shared, account:null };
      }
      if(!picked){
        const v1 = this.readJson(LEGACY_STORAGE_KEY);
        if(Schema.isLegacy(v1)) picked = { data:{ version:2, sections:{ operacoes:Schema.fromLegacy(v1) } }, account:null };
      }
      this._picked = picked;
      return picked;
    },

    // Preferências (tema) da conta migrada.
    previousProfile(){
      const picked = this.previousData();
      if(!picked || !picked.account) return null;
      const users = this.readJson(LEGACY_USERS_KEY);
      if(!Array.isArray(users)) return null;
      return users.find(function(u){ return isObj(u) && u.username === picked.account; }) || null;
    },

    // Apaga o que só servia ao login (lista de contas com hashes de senha, sessão).
    // Os dados antigos de cada conta NÃO são apagados.
    cleanup(){
      LEGACY_AUTH_KEYS.forEach(function(k){ try{ localStorage.removeItem(k); }catch{ /* nada a remover */ } });
    }
  };

  Object.assign(GE, { Migration });
})(window.GE = window.GE || {});
