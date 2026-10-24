// Dati non fidati contro il renderer vero (#456): messaggi ostili, link, query, risposte malformate, ponte del preload.
// Finestra nascosta, IPC simulato, rete bloccata e contata. Difetto noto = check `noto: 'ID'` (DEFECT_OPEN, uscita 2).
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_e, c) => c.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
app.on('window-all-closed', () => {});
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const { creaCronologiaScena } = require(path.join(root, 'dist/src/scena-cronologia.js'));
const { apriFinestra } = require(path.join(root, 'dist/src/finestra.js'));

const OSTILE = ['<img src="https://evil.example/p.png" onerror="window.__pwn=1">', '<script>window.__pwn=1</script>', '![t](https://evil.example/t.png)',
  '[clic](javascript:window.__pwn=1)', '<a href="https://evil.example">x</a>', '<iframe src="https://evil.example"></iframe>', '<svg onload="window.__pwn=1">',
  '<style>body{display:none}</style>', 'ctrl:\u0000\u0007\u001b[31m rosso', 'bidi:‮txt‬ zero:​‍', '${7*7} {{7*7}} `$(id)`'].join('\n');
const scene = JSON.parse(JSON.stringify(require('../design/scene/101-14849.json')));
const base = scene.elenco.sessioni[0];
scene.elenco.sessioni = [{ ...base, id: 's1', titolo: '<b>Titolo</b> <img src=x onerror=window.__pwn=1>' }, { ...base, id: 's2', titolo: 'Enorme' }];
const enorme = 'A'.repeat(2_000_000);
const fonti = {
  s1: [{ tipo: 'utente', testo: OSTILE, t: null }, { tipo: 'pensiero', testo: OSTILE, t: null }, { tipo: 'assistente', testo: OSTILE, modello: null, t: null },
    { tipo: 'strumento', id: 'u1', nome: 'Bash', ingresso: { command: OSTILE }, esito: { testo: OSTILE, errore: true }, t: null }, { tipo: 'errore', testo: OSTILE, t: null }],
  s2: [{ tipo: 'utente', testo: 'riga\n'.repeat(40000), t: null }, { tipo: 'assistente', testo: enorme, modello: null, t: null }],
};
scene.messaggi = fonti;
const storia = creaCronologiaScena((id) => fonti[id] ?? []);
const finto = { messaggi: null, elenco: null, lente: false, trattenute: [] };
const log = { console: [], main: [], eccezioni: [], rete: [] };
process.on('uncaughtException', (e) => log.eccezioni.push(String(e && e.stack || e)));
process.stderr.write = (s) => { log.main.push(String(s)); return true; }; // gli errori attesi non sporcano il riepilogo; quelli nuovi falliscono il check

let win, mostrate = 0, fuochi = 0;
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
const nuovaFinestra = () => {
  const w = new BrowserWindow({ show: false, focusable: false, width: 1800, height: 1000, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  w.on('show', () => mostrate++); w.on('focus', () => fuochi++);
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('console-message', (...a) => log.console.push(a.length > 1 ? { level: ['verbose', 'info', 'warning', 'error'][a[1]] || 'info', message: a[2] } : { level: a[0].level, message: a[0].message }));
  w.webContents.on('render-process-gone', (_e, d) => log.eccezioni.push('render-process-gone ' + d.reason));
  w.webContents.session.webRequest.onBeforeRequest((d, cb) => { const ext = !/^(file|devtools|data|about|blob):/.test(d.url); if (ext) log.rete.push(d.url); cb({ cancel: ext }); });
  return w;
};
const run = async (fn, ...a) => {
  const r = await win.webContents.executeJavaScript(`(async () => { try { return { v: await (${fn})(...${JSON.stringify(a)}) }; } catch (e) { return { e: String(e && e.message || e) }; } })()`);
  if (r.e) throw new Error(r.e);
  return r.v;
};
const wait = (fn, ...a) => win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 8000; const f = ${fn};
  const t = () => { let v = false; try { v = f(...${JSON.stringify(a)}); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 100))})) : setTimeout(t, 20); }; t(); })`);
const carica = (q) => win.loadFile(path.join(root, 'renderer/index.html'), { query: q });
const radiceViva = () => run(() => document.getElementById('radice').children.length > 0 && document.body.innerText.length > 0);

const risultati = [];
async function check(nome, fn, { noto, consenti = /^$/ } = {}) {
  Object.assign(finto, { messaggi: null, elenco: null, lente: false, trattenute: [] });
  const c0 = log.console.length, m0 = log.main.length, e0 = log.eccezioni.length, r0 = log.rete.length;
  let errore = null;
  try {
    await fn();
    const rumore = [...log.console.slice(c0).filter((m) => m.level === 'warning' || m.level === 'error').map((m) => 'console: ' + m.message), ...log.main.slice(m0).map((s) => 'main: ' + s), ...log.eccezioni.slice(e0)];
    const nuovi = rumore.filter((s) => !consenti.test(s));
    assert.deepEqual(nuovi, [], 'errori o warning nuovi: ' + nuovi.slice(0, 2).join(' | ').replace(/\s+/g, ' ').slice(0, 300));
    assert.deepEqual(log.rete.slice(r0), [], 'nessuna richiesta di rete');
  } catch (e) { errore = e; }
  const stato = !errore ? (noto ? 'DEFECT_FIXED' : 'OK') : noto ? 'DEFECT_OPEN' : 'FAIL';
  risultati.push({ nome, stato });
  console.log(`${stato} ${nome}${noto ? ` [${noto}]` : ''}${errore ? ': ' + String(errore.message).split('\n')[0].slice(0, 220) : ''}`);
}

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  for (const c of ['sessioni:messaggi', 'sessioni:elenco', 'clotch-ai:comando']) ipcMain.removeHandler(c);
  ipcMain.handle('clotch-ai:comando', () => ({ esito: 'ok' }));
  ipcMain.handle('sessioni:elenco', () => (finto.elenco ? finto.elenco() : scene.elenco));
  ipcMain.handle('sessioni:messaggi', (_e, id, pagina, opz) => {
    const r = storia.pagina(id, pagina, opz);
    return finto.messaggi ? finto.messaggi(id, r) : finto.lente ? new Promise((res) => finto.trattenute.push(() => res(r))) : r;
  });
  win = nuovaFinestra();

  await check('MESSAGGI_OSTILI_SONO_SOLO_TESTO', async () => {
    await carica({ vista: 'sessione', sessione: 's1' });
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent.includes('<script>window.__pwn=1</script>'));
    await run(() => document.querySelectorAll('.filo button.testata').forEach((b) => b.getAttribute('aria-expanded') === 'false' && b.click()));
    await attesa(300);
    const r = await run(() => { const f = document.querySelector('.filo');
      // gli indirizzi web scritti da Roberto diventano link (#787): solo https/http, scritti per intero, in una scheda a parte e senza opener; ogni altro elemento è ostile
      const sicuro = (e) => e.tagName === 'A' && /^https?:\/\//.test(e.getAttribute('href')) && e.getAttribute('href') === e.textContent && e.target === '_blank' && /noopener/.test(e.rel) && e.attributes.length <= 4;
      return { vivi: [...f.querySelectorAll('img,iframe,object,embed,a,script,style,form,video,audio,[onerror],[onload],[onclick],[href]')].filter((e) => !sicuro(e)).length,
        testo: f.innerText, pwn: !!window.__pwn, corpo: getComputedStyle(document.body).display }; });
    assert.equal(r.vivi, 0, 'nessun elemento nato dal testo');
    assert.equal(r.pwn, false); assert.notEqual(r.corpo, 'none');
    assert.ok(/!\[t\]\(https:\/\/evil\.example\/t\.png\)/.test(r.testo) && /\[clic\]\(javascript:/.test(r.testo), 'markdown e link restano testo');
    assert.ok((r.testo.match(/<iframe src="https:\/\/evil.example"><\/iframe>/g) || []).length >= 3, 'HTML letterale in utente, pensiero, risposta');
  });

  await check('TESTO_ENORME_NON_BLOCCA', async () => {
    const t0 = Date.now(); await carica({ vista: 'sessione', sessione: 's2' });
    await wait(() => document.querySelector('.testo-risposta')?.textContent.length >= 2_000_000);
    const t1 = Date.now(); await run(() => 1);
    assert.ok(Date.now() - t0 < 20000, 'render sotto 20 s'); assert.ok(Date.now() - t1 < 2000, 'pagina ancora reattiva');
    assert.equal(await run(() => document.querySelectorAll('.messaggio-roberto .bolla').length), 1);
  });

  await check('PONTE_DEL_PRELOAD', async () => { // l'eval rifiutato dalla CSP è il segnale atteso, non rumore
    await carica({ vista: 'sessione', sessione: 's1' });
    const r = await run(() => ({ nodo: [typeof require, typeof process, typeof Buffer, typeof module, typeof electron], k: Object.keys(window.sessioni).sort(), f: Object.keys(window.clotchAi).sort(), i: Object.keys(window.impostazioni).sort(),
      fn: (() => { try { return window.sessioni.elencoSessioni.constructor('return typeof process')(); } catch (e) { return 'bloccato'; } })() }));
    assert.deepEqual(r.nodo, ['undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
    assert.notEqual(r.fn, 'object', 'il costruttore di Function non raggiunge Node');
    assert.deepEqual(r.k, ['azione', 'cerca', 'comandi', 'elencoSessioni', 'file', 'impostaImpostazioni', 'impostaPreferenze', 'impostazioni', 'info', 'menuBarra', 'messaggi', 'modelli', 'onAggiornamento', 'onImpostazioni', 'onMenu', 'onPreferenze', 'preferenze', 'ricostruisci', 'spazio', 'svuota']);
    assert.deepEqual(r.f, ['avvia', 'comando', 'dettatura', 'onDettatura', 'onRegistro', 'onVoce', 'registro', 'voce']);
    assert.deepEqual(r.i, ['apri', 'archiviate', 'aggiornamenti', 'avvio', 'cartelle', 'eliminaDati', 'novita', 'profilo', 'radici', 'scegliCartella', 'uso', 'versione'].sort());
  }, { consenti: /unsafe-eval|script-src/ });

  await check('AGGIORNAMENTO_MALFORMATO_NON_FERMA_GLI_ALTRI', async () => {
    await carica({ vista: 'sessione', sessione: 's1' }); await wait(() => document.querySelectorAll('.riga-sessione').length === 2);
    scene.elenco.sessioni[1].titolo = 'Enorme rinominata';
    for (const a of [{ cronologia: [null] }, { cronologia: 'x' }, { cronologia: [{ tipo: 'upsert', sessione: 's1' }] }, { sessioni: 'x' }, null]) {
      win.webContents.send('sessioni:aggiornamento', a === null ? null : { sessioni: ['s2'], nuoviMessaggi: [], ...a }); await attesa(60);
    }
    await wait(() => [...document.querySelectorAll('.riga-sessione .testo')].some((e) => e.textContent === 'Enorme rinominata'));
    assert.equal(await radiceViva(), true); scene.elenco.sessioni[1].titolo = 'Enorme';
  });

  await check('ERRORE_DEL_PROTOTIPO_NON_INQUINA', async () => {
    await carica({ vista: 'sessione', sessione: 's1' }); await wait(() => document.querySelectorAll('.riga-sessione').length === 2);
    win.webContents.send('sessioni:aggiornamento', JSON.parse('{"sessioni":[],"nuoviMessaggi":[],"__proto__":{"polluto":1},"constructor":{"prototype":{"polluto":1}}}'));
    await attesa(100); assert.equal(await run(() => ({}).polluto), undefined);
  });

  await check('LETTURA_CHE_NON_FINISCE_E_POI_CAMBIO_CHAT', async () => {
    finto.lente = true; await carica({ vista: 'sessione', sessione: 's1' });
    await wait(() => document.querySelectorAll('.riga-sessione').length === 2); await attesa(300);
    assert.equal(await run(() => !!document.querySelector('.sagome')), true, 'sagome finché la lettura non finisce');
    finto.lente = false; await run(() => [...document.querySelectorAll('.riga-sessione .testo')].find((e) => e.textContent === 'Enorme').click());
    await wait(() => !!document.querySelector('.testo-risposta'));
  });

  await check('MESSAGGIO_MALFORMATO_NON_ROMPE_L_APP', async () => {
    const bianche = [];
    for (const m of [{ tipo: 'sconosciuto', testo: 5 }, null, { tipo: 'assistente', testo: null, modello: null, t: null }, { tipo: 'strumento', id: 1, nome: null, ingresso: null, esito: null, t: null }]) {
      finto.messaggi = (id, r) => ({ ...r, cronologia: { ...r.cronologia, righe: [{ chiave: 'k:1', ordine: 1, revisione: 1, messaggio: m }], totaleSnapshot: 1 } });
      await carica({ vista: 'sessione', sessione: 's1' }); await attesa(400);
      if (!(await radiceViva())) bianche.push(JSON.stringify(m));
    }
    assert.equal(bianche.length, 0, 'app bianca con: ' + bianche.join(' ; '));
  });

  await check('ELENCO_MALFORMATO_NON_ROMPE_L_APP', async () => {
    const bianche = [];
    for (const [nome, f] of [['null', () => null], ['sessioni-null', () => ({ sessioni: null, errori: [] })], ['senza-errori', () => ({ sessioni: [] })], ['senza-titolo', () => ({ sessioni: [{ id: 's1' }], errori: [] })]]) {
      finto.elenco = f; await carica({ vista: 'sessione', sessione: 's1' }); await attesa(400);
      if (!(await radiceViva())) bianche.push(nome);
    }
    assert.equal(bianche.length, 0, 'app bianca con: ' + bianche.join(' ; '));
  });

  for (const q of [{ vista: 'constructor' }, { vista: 'impostazioni', sezione: 'constructor' }, { vista: 'impostazioni', sezione: '__proto__' }, { vista: 'impostazioni', sezione: 'toString' },
    { vista: 'sessione', sessione: '<script>window.__x=1</script>' }, { vista: 'sessione', sessione: 's999' }, { vista: 'sessione', sessione: 'x'.repeat(8000) }]) {
    await check('QUERY_OSTILE_' + JSON.stringify(q).slice(1, 60), async () => {
      await carica(q); await attesa(500);
      assert.equal(await radiceViva(), true, 'app bianca'); assert.equal(await run(() => !!window.__x), false);
    });
  }

  const spostano = [];
  await check('LINK_OSTILI_APRONO_SOLO_WEB', async () => {
    const aperti = []; shell.openExternal = async (u) => { aperti.push(u); }; dialog.showMessageBox = async () => ({ response: 0 });
    const prima = win; win = apriFinestra(undefined, { show: false });
    try {
      await new Promise((r) => win.webContents.once('did-finish-load', r)); const url0 = win.webContents.getURL().split('#')[0];
      const ostili = ['JaVaScRiPt:window.__pwn=1', '\tjavascript:1', '//evil.example/x', 'blob:https://evil.example/u', 'filesystem:https://evil.example/t', 'view-source:https://evil.example', 'ws://evil.example',
        'wss://evil.example', 'ftp://evil.example', 'about:blank', 'chrome://gpu', 'devtools://devtools/x', 'https://exa mple.com', 'http://[::1', 'https://u:p@evil.example', 'file:///etc/passwd', 'data:text/html,<script>1</script>', 'x'.repeat(100000)];
      for (const u of ostili) {
        await run((u) => {
          const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.textContent = 'x'; document.body.append(a); a.click(); a.remove();
          try { window.open(u); } catch {} try { window.location.href = u; } catch {}
        }, u);
        await attesa(150);
        if (win.webContents.getURL().split('#')[0] !== url0) { spostano.push(u.slice(0, 30)); await win.loadURL(url0); }
      }
      assert.deepEqual(aperti.filter((u) => !/^https?:\/\//.test(u)), [], 'solo http(s) arriva al sistema');
      assert.ok(!aperti.some((u) => /evil\.example/.test(u) && /u:p@/.test(u)), 'mai credenziali nell\'URL');
      assert.equal(BrowserWindow.getAllWindows().filter((w) => w !== prima).length, 1, 'nessuna finestra figlia');
      assert.equal(win.isVisible(), false); assert.equal(mostrate, 0);
    } finally { const w = win; win = prima; w.destroy(); }
  });

  await check('PAGINA_RESTA_DOVE_E_DOPO_URL_OSTILI', async () => assert.equal(spostano.length, 0, 'location.href porta la pagina a about:blank#blocked con: ' + JSON.stringify(spostano)));

  await check('ANTEPRIMA_SILENZIOSA_CHIAMATE_SHOW_E_FOCUS', async () => { // CLOTCH_TEST_SILENT=1 da solo non chiama mai show/showInactive/focus; l'anteprima visibile vuole anche CLOTCH_TEST_ANTEPRIMA=1
    const chiamate = { show: 0, showInactive: 0, focus: 0 }, orig = {}, P = BrowserWindow.prototype;
    for (const k of Object.keys(chiamate)) { orig[k] = P[k]; P[k] = function () { chiamate[k]++; }; }
    const conta = async (opz) => {
      const prima = { ...chiamate }; const w = apriFinestra(undefined, opz);
      await new Promise((r) => w.webContents.once('did-finish-load', r)); await attesa(600); w.destroy();
      return Object.fromEntries(Object.keys(chiamate).map((k) => [k, chiamate[k] - prima[k]]));
    };
    try {
      const predefinita = await conta(undefined), nascosta = await conta({ show: false }), esplicita = await conta({ show: true });
      process.env.CLOTCH_TEST_ANTEPRIMA = '1';
      const anteprima = await conta(undefined), anteprimaNascosta = await conta({ show: false });
      delete process.env.CLOTCH_TEST_ANTEPRIMA;
      console.log(`MISURA_SHOW_FOCUS predefinita=${JSON.stringify(predefinita)} show:false=${JSON.stringify(nascosta)} show:true=${JSON.stringify(esplicita)} anteprima=${JSON.stringify(anteprima)} anteprima+show:false=${JSON.stringify(anteprimaNascosta)}`);
      const zero = { show: 0, showInactive: 0, focus: 0 };
      assert.deepEqual(predefinita, zero, 'SILENT da solo = nessuna show, showInactive né focus');
      assert.deepEqual(nascosta, zero, 'show:false = nessuna chiamata');
      assert.deepEqual(esplicita, zero, 'SILENT batte anche show:true');
      assert.deepEqual(anteprima, { show: 0, showInactive: 1, focus: 0 }, 'anteprima esplicita = una showInactive, mai show né focus');
      assert.deepEqual(anteprimaNascosta, zero, 'show:false vince anche sull\'anteprima');
    } finally { delete process.env.CLOTCH_TEST_ANTEPRIMA; for (const k of Object.keys(orig)) P[k] = orig[k]; }
  });

  assert.equal(mostrate, 0, 'nessun evento show'); assert.equal(fuochi, 0, 'nessun evento focus');
  assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false); assert.equal(win.webContents.isAudioMuted(), true);
  const aperti = risultati.filter((r) => r.stato === 'DEFECT_OPEN'), rotti = risultati.filter((r) => r.stato === 'FAIL');
  console.log(`HIDDEN_WINDOW_OK shows=${mostrate} focus=${fuochi}`);
  console.log(`SICUREZZA_RIEPILOGO ok=${risultati.filter((r) => r.stato === 'OK').length} fail=${rotti.length} difetti_aperti=${aperti.length} difetti_chiusi=${risultati.filter((r) => r.stato === 'DEFECT_FIXED').length}`);
  app.exit(rotti.length ? 1 : aperti.length ? 2 : 0);
}).catch((e) => { console.error(e); app.exit(1); });
