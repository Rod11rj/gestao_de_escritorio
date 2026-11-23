/**
 * Configuração: chaves de armazenamento, paletas de cores, rótulos e limites.
 */
(function (GE) {
  "use strict";
  /* ============================================================ */
  /* ---------- Configuração ---------- */
  /* ============================================================ */
  // Seções criadas no primeiro acesso. Depois disso, a lista (nomes e ordem)
  // fica salva nos dados e é editada pelo usuário em "Seções › Editar".
  const DEFAULT_SECTIONS = [
    { id:"administracao", name:"Administração" },
    { id:"organizacao",   name:"Organização" },
    { id:"operacoes",     name:"Operações" },
    { id:"logistica",     name:"Logística" },
    { id:"ged",           name:"GED" }
  ];
  const DEFAULT_VIEW = { section:"operacoes", module:"kanban" };
  const SECTION_NAME_MAX = 40;

  // Armazenamento no navegador (localStorage)
  const DATA_KEY = "equipe-app-v3";          // dados do sistema
  const PREFS_KEY = "equipe-profile-v1";     // preferências (tema)
  const LAST_VIEW_KEY = "equipe-last-view-v3";
  // Chaves de versões anteriores, lidas só na migração
  const LEGACY_SHARED_KEY = "equipe-app-v2";          // versão sem contas
  const LEGACY_ACCOUNT_PREFIX = "equipe-app-v2:";     // versão com contas: "equipe-app-v2:<usuário>"
  const LEGACY_STORAGE_KEY = "equipe-kanban-v1";      // formato mais antigo (uma única seção)
  const LEGACY_USERS_KEY = "equipe-users-v1";
  const LEGACY_SESSION_KEY = "equipe-session-v1";
  const LEGACY_AUTH_KEYS = ["equipe-users-v1", "equipe-session-v1", "equipe-auth-v1", "equipe-legacy-claimed", "equipe-theme-last"];

  // Cores disponíveis para grupos de tarefas (o usuário escolhe ao clicar na bolinha).
  const GROUP_PALETTE = ["navy","steel","teal","moss","olive","slate","plum","rose","brick","clay","amber","gold"];
  const GROUP_PALETTE_HEX = { moss:"#5B6B45", olive:"#7A7434", teal:"#3F7368", steel:"#3E5C66", navy:"#2F5D8C",
    slate:"#5B5F73", plum:"#6E4F78", rose:"#A14A6B", brick:"#9C3B2E", clay:"#8A5A44", amber:"#B9701F", gold:"#8F7A1E" };
  const GROUP_PALETTE_NAMES = { moss:"Musgo", olive:"Oliva", teal:"Verde-azulado", steel:"Aço", navy:"Azul-marinho",
    slate:"Ardósia", plum:"Ameixa", rose:"Rosa", brick:"Tijolo", clay:"Argila", amber:"Âmbar", gold:"Ouro" };
  const GROUP_NAME_MAX = 30;
  // Usado só para converter tarefas criadas quando os grupos eram fixos.
  const LEGACY_GROUPS = { adestramento:{ name:"Adestramento", color:"moss" }, planejamento:{ name:"Planejamento", color:"steel" } };
  const PRIORITY_LABEL = { baixa:"Baixa", media:"Média", alta:"Alta" };
  const ENTITY_PALETTE = ["navy","steel","teal","amber","clay","slate","moss"];
  const ENTITY_PALETTE_HEX = { navy:"#2F5D8C", steel:"#3E5C66", teal:"#3F7368", amber:"#B9701F", clay:"#8A5A44", slate:"#5B5F73", moss:"#5B6B45" };
  const WEEKDAY_SHORT = ["dom","seg","ter","qua","qui","sex","sáb"];
  const MONTH_NAMES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

  Object.assign(GE, { DEFAULT_SECTIONS, DEFAULT_VIEW, SECTION_NAME_MAX, DATA_KEY, PREFS_KEY, LAST_VIEW_KEY, LEGACY_SHARED_KEY, LEGACY_ACCOUNT_PREFIX, LEGACY_STORAGE_KEY, LEGACY_USERS_KEY, LEGACY_SESSION_KEY, LEGACY_AUTH_KEYS, GROUP_PALETTE, GROUP_PALETTE_HEX, GROUP_PALETTE_NAMES, GROUP_NAME_MAX, LEGACY_GROUPS, PRIORITY_LABEL, ENTITY_PALETTE, ENTITY_PALETTE_HEX, WEEKDAY_SHORT, MONTH_NAMES });
})(window.GE = window.GE || {});
