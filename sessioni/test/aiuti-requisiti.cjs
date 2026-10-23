// Base comune delle prove dei requisiti (#456): Electron silenzioso (finestra nascosta, audio spento, mai in primo piano), main simulato
// dalle scene del disegno con i canali IPC che registrano le chiamate, e `req(id, fn)` che stampa «REQ <id> ok» o «REQ <id> difetto: …».
// Non è una prova da sola (prove-dom esegue solo i *.dom.cjs): la usano requisiti-a.dom.cjs e requisiti-b.dom.cjs.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_e, c) => c.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
app.on('window-all-closed', () => {});
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { rispostaScena, CANALI } = require(path.join(root, 'dist/src/scena.js'));

const H = { rispostaScena, root, assert, ora: Date.now(), scena: null, chiamate: [], rispondi: {}, win: null };
const DELTA = H.ora - 1792768490307; // le scene del disegno hanno l'ora del disegno: il registro si sposta a «adesso»
const ritempra = (o) => Array.isArray(o) ? o.map(ritempra) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ritempra(v)])) : typeof o === 'number' && o > 1.7e12 && o < 1.9e12 ? o + DELTA : o;
H.daScena = (id, mod) => { // una scena del disegno com'è, col registro all'ora di adesso
  const s = JSON.parse(JSON.stringify(require(`../design/scene/${id}.json`)));
  if (s.registro) s.registro = ritempra(s.registro);
  mod?.(s); H.scena = s; return s;
};
H.U = (testo, dt = 0) => ({ tipo: 'utente', testo, t: H.ora - 60000 + dt });
H.AS = (testo, dt = 0) => ({ tipo: 'assistente', testo, modello: 'claude-opus-5-5', t: H.ora - 60000 + dt });
H.PE = (testo, dt = 0) => ({ tipo: 'pensiero', testo, t: H.ora - 60000 + dt });
H.nuova = (mod) => { // tre sessioni: s1 al lavoro (clotch, Friday vivo), s2 finita (Codex, beta-app), s3 in attesa (clotch)
  const s = JSON.parse(JSON.stringify(require('../design/scene/101-14849.json'))), b = s.elenco.sessioni[0], ora = H.ora;
  const se = (id, titolo, sorgente, stato, dt) => ({ ...b, id, titolo, sorgente, stato, progetto: id === 's2' ? 'beta-app' : 'clotch', ultimaAttivita: ora - dt });
  s.elenco.sessioni = [se('s1', 'Alfa uno', 'claude-code', 'lavora', 3000), se('s2', 'Beta due', 'codex', 'finita', 1000), se('s3', 'Gamma tre', 'claude-code', 'aspetta', 2000)];
  s.messaggi = { s1: [H.U('Messaggio A uno')], s2: [H.U('Messaggio B due')], s3: [H.U('Messaggio C tre')] };
  s.preferenze = {};
  Object.assign(s.registro.chat.s1, { battito: ora, visto: ora, coda: [] });
  mod?.(s); H.scena = s; return s;
};
H.fatte = (c) => H.chiamate.filter((x) => x[0] === c).map((x) => x.slice(1));
H.azzera = () => { H.chiamate = []; };
const log = { console: [], main: [], eccezioni: [] };
process.on('uncaughtException', (e) => log.eccezioni.push(String(e && e.stack || e)));
process.stderr.write = (s) => { log.main.push(String(s)); return true; }; // gli errori attesi si dichiarano con `consenti`; i nuovi fanno fallire il requisito

H.attesa = (ms) => new Promise((r) => setTimeout(r, ms));
H.run = async (fn, ...a) => {
  const r = await H.win.webContents.executeJavaScript(`(async () => { try { return { v: await (${fn})(...${JSON.stringify(a)}) }; } catch (e) { return { e: String(e && e.message || e) }; } })()`);
  if (r.e) throw new Error(r.e);
  return r.v;
};
H.wait = (fn, ...a) => H.win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 4000; const f = ${fn};
  const t = () => { let v = false; try { v = f(...${JSON.stringify(a)}); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 110))})) : setTimeout(t, 15); }; t(); })`);
H.clicca = (sel, testo) => H.run((sel, testo) => { const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').trim() === testo || e.getAttribute('aria-label') === testo); if (!el) throw new Error('manca ' + sel + ' ' + testo); el.click(); }, sel, testo);
H.scrivi = (sel, testo) => H.run((sel, testo) => { const el = document.querySelector(sel);
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, testo); el.dispatchEvent(new Event('input', { bubbles: true })); }, sel, testo);
H.tasto = (sel, init) => H.run((sel, init) => document.querySelector(sel).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })), sel, init);
H.testo = (sel) => H.run((sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent), sel);
H.carica = (q) => H.win.loadFile(path.join(root, 'renderer/index.html'), { query: q });
H.caricaChat = async (id = 's1') => { await H.carica({ vista: 'sessione', sessione: id }); await H.wait(() => !!document.querySelector('.messaggio-roberto .bolla') && !!document.querySelector('textarea')); };
H.caricaScena = async () => { await H.carica(H.scena.navigazione); await H.wait(() => !!document.querySelector('.cornice')); await H.attesa(120); };
H.esc = () => H.tasto('body', { key: 'Escape' });
H.barra = () => H.run(() => [...document.querySelectorAll('.riga-sessione .testo')].map((e) => e.textContent));
H.riga = (etichetta) => H.clicca('.barra-laterale .riga .testo', etichetta);
H.voce = (testo) => H.clicca('.menu .voce .etichetta, .menu-filtro .voce .etichetta', testo);
H.aggiorna = (...ids) => H.win.webContents.send('sessioni:aggiornamento', { sessioni: ids, nuoviMessaggi: [] });

const esiti = [];
H.req = async (id, fn, { consenti = /^$/ } = {}) => {
  Object.keys(H.rispondi).forEach((k) => delete H.rispondi[k]); H.azzera();
  const c0 = log.console.length, m0 = log.main.length, e0 = log.eccezioni.length;
  let errore = null;
  try {
    await fn();
    const rumore = [...log.console.slice(c0).filter((m) => m.level === 'warning' || m.level === 'error').map((m) => 'console: ' + m.message), ...log.main.slice(m0).map((s) => 'main: ' + s), ...log.eccezioni.slice(e0)];
    const nuovi = rumore.filter((s) => !consenti.test(s));
    assert.deepEqual(nuovi, [], 'errori o warning nuovi: ' + nuovi.slice(0, 2).join(' | ').replace(/\s+/g, ' ').slice(0, 300));
  } catch (e) { errore = e; }
  esiti.push({ id, ok: !errore });
  console.log(`REQ ${id} ${errore ? 'difetto: ' + String(errore.message).replace(/\s+/g, ' ').slice(0, 330) : 'ok'}`);
  if (errore) console.log(`DEFECT_OPEN REQ-${id} [REQ-${id}]`);
};

/** Avvia Electron silenzioso e dà il controllo a `corpo`; alla fine controlla show=0 focus=0 e esce (0 tutto ok, 2 difetti noti, 1 prova rotta). */
H.avvia = (nome, corpo) => app.whenReady().then(async () => {
  let mostrate = 0, fuochi = 0;
  for (const c of CANALI) ipcMain.handle(c, (_e, ...a) => {
    H.chiamate.push([c, ...a]);
    if (c in H.rispondi) return H.rispondi[c](...a);
    if (c === 'sessioni:imposta-impostazioni') H.scena.impostazioni = { ...H.scena.impostazioni, ...a[0] }; // il main salva nel file delle preferenze
    return rispostaScena(H.scena, c, a);
  });
  ipcMain.removeHandler('friday:comando'); // di serie risponde «fatto», senza toccare Friday
  ipcMain.handle('friday:comando', (_e, ...a) => { H.chiamate.push(['friday:comando', ...a]); return 'friday:comando' in H.rispondi ? H.rispondi['friday:comando'](...a) : { esito: 'ok', testo: '' }; });
  const w = H.win = new BrowserWindow({ show: false, focusable: false, width: 1800, height: 1000, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  w.on('show', () => mostrate++); w.on('focus', () => fuochi++);
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('console-message', (...a) => log.console.push(a.length > 1 ? { level: ['verbose', 'info', 'warning', 'error'][a[1]] || 'info', message: a[2] } : { level: a[0].level, message: a[0].message }));
  w.webContents.on('render-process-gone', (_e, d) => log.eccezioni.push('render-process-gone ' + d.reason));
  await corpo();
  assert.equal(mostrate, 0, 'nessun evento show'); assert.equal(fuochi, 0, 'nessun evento focus');
  assert.equal(w.isVisible(), false); assert.equal(w.isFocused(), false); assert.equal(w.webContents.isAudioMuted(), true);
  console.log(`HIDDEN_WINDOW_OK shows=${mostrate} focus=${fuochi}`);
  const aperti = esiti.filter((r) => !r.ok).length;
  console.log(`PERCORSI_RIEPILOGO ${nome} ok=${esiti.length - aperti} fail=0 difetti_aperti=${aperti}`);
  app.exit(aperti ? 2 : 0);
}).catch((e) => { console.error(e); app.exit(1); });

module.exports = H;
