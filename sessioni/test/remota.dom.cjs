// #1001: chat di una sessione dell'app Claude su una macchina SSH, nel renderer vero con un motore finto: apre -> chiama `trascrizione_remota` -> mostra i messaggi;
// rifiuto -> testo del motore + «Riprova»; copia già sul Mac e sessione ferma -> nessuna chiamata; sessione al lavoro -> richiama ogni pochi secondi, e smette a chat chiusa.
const { app, BrowserWindow, ipcMain } = require('electron');
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

const scene = JSON.parse(JSON.stringify(require('../design/scene/101-14849.json')));
const base = scene.elenco.sessioni[0], ora = Date.now();
const HOST = 'sandbox-app@1.2.3.4';
const remota = (id, titolo, stato, file) => ({ ...base, id, idApp: `local_${id}`, titolo, sorgente: 'claude-desktop', stato, file, ultimaAttivita: ora - 1000,
  app: { padre: null, prs: [], connettori: [], strumentiMcp: 0, cli: null, ospite: HOST, remoto: false } });
const sessioni = [remota('r1', 'Remota uno', 'ferma', '/x/local_r1.json'), remota('r2', 'Remota due', 'lavora', '/x/local_r2.json'),
  remota('r3', 'Remota tre', 'ferma', '/x/r3.jsonl'), { ...base, id: 'l1', titolo: 'Locale uno', stato: 'ferma', file: '/x/l1.jsonl' }];
scene.elenco.sessioni = sessioni;
const utente = (testo) => ({ tipo: 'utente', testo, t: null });
const fonti = { r1: [], r2: [], r3: [utente('copia dell’app')], l1: [utente('locale')] };
const storia = creaCronologiaScena((id) => fonti[id] ?? []);

// il motore finto: cosa risponde a `trascrizione_remota`, le chiamate ricevute, e (se `trattieni`) la risposta ferma finché il test la rilascia
const motore = { risposta: 'ok', chiamate: [], trattieni: false, rilascia: null, testo: 'rifiutato' };
const log = { console: [], eccezioni: [] };
process.on('uncaughtException', (e) => log.eccezioni.push(String(e && e.stack || e)));
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
let win;

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  for (const c of ['sessioni:messaggi', 'sessioni:elenco', 'clotch-ai:comando']) ipcMain.removeHandler(c);
  ipcMain.handle('sessioni:elenco', () => scene.elenco);
  ipcMain.handle('sessioni:messaggi', (_e, id, pagina, opz) => {
    const s = sessioni.find((x) => x.id === id);
    if (s && !s.file.endsWith('.jsonl')) return { messaggi: [], pagina, haAltre: false, totale: null, errore: 'Trascrizione non trovata sul disco',
      erroreCronologia: { codice: 'non_letta', testo: 'Trascrizione non trovata sul disco', ripartenza: 'nuova_snapshot' } };
    return storia.pagina(id, pagina, opz);
  });
  ipcMain.handle('clotch-ai:comando', async (_e, cmd, args) => {
    if (cmd !== 'trascrizione_remota') return { id: 'c', esito: 'ok', testo: '' };
    motore.chiamate.push(args);
    if (motore.trattieni) await new Promise((r) => { motore.rilascia = r; });
    if (motore.risposta === 'rifiuto') return { id: 'c', esito: 'rifiutato', testo: motore.testo };
    const s = sessioni.find((x) => `local_${x.id}` === args.sessione);
    if (!s.file.endsWith('.jsonl')) { // come il main: la copia c'è e l'elenco la vede prima della risposta
      s.file = `/casella/${s.id}.jsonl`; fonti[s.id] = [utente(`messaggio di ${s.id}`)];
      win.webContents.send('sessioni:aggiornamento', { sessioni: [s.id], nuoviMessaggi: [] });
    }
    return { id: 'c', esito: 'ok', testo: '', percorso: s.file, byte: 10, fonte: 'ssh' };
  });

  win = new BrowserWindow({ show: false, focusable: false, width: 1800, height: 1000, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  win.webContents.on('console-message', (...a) => log.console.push(a.length > 1 ? { level: ['verbose', 'info', 'warning', 'error'][a[1]] || 'info', message: a[2] } : { level: a[0].level, message: a[0].message }));
  const run = (fn, ...a) => win.webContents.executeJavaScript(`(${fn})(...${JSON.stringify(a)})`);
  const wait = (fn, ...a) => win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 4000; const f = ${fn};
    const t = () => { let v = false; try { v = f(...${JSON.stringify(a)}); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 110))})) : setTimeout(t, 15); }; t(); })`);
  const apri = (id) => win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: id } });
  const bolle = () => run(() => [...document.querySelectorAll('.messaggio-roberto .bolla')].map((e) => e.textContent));
  const centro = () => run(() => document.querySelector('.messaggio-al-centro')?.textContent || '');
  const nuovo = (risposta = 'ok') => Object.assign(motore, { risposta, chiamate: [], trattieni: false, rilascia: null });
  const failures = [];
  const check = async (nome, fn) => { try { await fn(); console.log(`OK ${nome}`); } catch (e) { failures.push(nome); console.error(`FAIL ${nome}: ${e.message}`); } };

  await check('REMOTA_OK_MOSTRA_I_MESSAGGI_SENZA_ERRORE_NEL_MEZZO', async () => {
    nuovo(); motore.trattieni = true;
    await apri('r1');
    await wait(() => !!document.querySelector('.sagome'));
    await attesa(300);
    assert.equal(await run(() => !!document.querySelector('.sagome')), true, 'mentre il motore lavora: caricamento');
    assert.doesNotMatch(await centro(), /non su questo Mac|non è sul disco/, 'mai il vecchio errore');
    motore.rilascia();
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'messaggio di r1');
    assert.deepEqual(motore.chiamate, [{ sessione: 'local_r1' }]);
    await attesa(300);
    assert.equal(motore.chiamate.length, 1, 'sessione ferma: una chiamata sola');
  });

  await check('RIFIUTO_DEL_MOTORE_TESTO_E_RIPROVA', async () => {
    sessioni[0].file = '/x/local_r1.json'; fonti.r1 = []; nuovo('rifiuto'); motore.testo = 'macchina non raggiungibile: ' + HOST;
    await apri('r1');
    await wait(() => document.querySelector('.messaggio-al-centro')?.textContent.includes('macchina non raggiungibile'));
    assert.match(await centro(), /Messaggi non letti/);
    assert.deepEqual(await run(() => [...document.querySelectorAll('.messaggio-al-centro button')].map((b) => b.textContent)), ['Riprova']);
    await attesa(300);
    assert.equal(motore.chiamate.length, 1, 'dopo un rifiuto non si insiste da soli');
    motore.risposta = 'ok';
    await run(() => document.querySelector('.messaggio-al-centro button').click());
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'messaggio di r1');
    assert.equal(motore.chiamate.length, 2);
  });

  await check('COPIA_PRESENTE_E_SESSIONE_FERMA_NESSUNA_CHIAMATA', async () => {
    nuovo(); await apri('r3');
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'copia dell’app');
    await attesa(400);
    assert.equal(motore.chiamate.length, 0);
    await apri('l1'); await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'locale');
    await attesa(300);
    assert.equal(motore.chiamate.length, 0, 'sessione locale: mai');
  });

  await check('SESSIONE_AL_LAVORO_RICHIAMA_E_SI_FERMA_A_CHAT_CHIUSA', async () => {
    nuovo(); await apri('r2');
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'messaggio di r2');
    const t0 = Date.now(); while (motore.chiamate.length < 2 && Date.now() - t0 < 7000) await attesa(100);
    assert.ok(motore.chiamate.length >= 2, `richiamato dopo qualche secondo (chiamate: ${motore.chiamate.length})`);
    await apri('l1'); await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'locale');
    const n = motore.chiamate.length; await attesa(6500);
    assert.equal(motore.chiamate.length, n, 'chat chiusa: nessuna chiamata');
  });

  const rumore = log.console.filter((m) => m.level === 'warning' || m.level === 'error').map((m) => m.message).concat(log.eccezioni);
  if (rumore.length) failures.push('rumore: ' + rumore[0].slice(0, 200));
  console.log(failures.length ? `FAIL ${failures.join(', ')}` : 'TUTTO OK');
  app.exit(failures.length ? 1 : 0);
});
