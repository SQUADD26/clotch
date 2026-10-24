// La casella nel renderer reale (#437), IPC intercettato: menu «/» e «@», chip dei permessi e del modello, «Non inviato». Finestra mai visibile, mai attiva, muta.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const { creaCronologiaScena } = require('../dist/src/scena-cronologia.js');

app.whenReady().then(async () => {
  const scene = structuredClone(require('../design/scene/101-26745.json'));
  scene.file = ['sessioni/src/lettore.ts', 'sessioni/src/lettore.test.ts', 'sessioni/src/lettura/cartelle.ts'];
  scene.navigazione.sezione = undefined;
  scene.preferenze = { s1: { icona: 'stella', modello: 'claude-fable-5-1' } }; // la chat ha scelto un modello diverso da quello della sessione
  scene.registro.chat.s1 = { chat: 's1', coda: [], richieste: [], contestoMax: 200000 }; // la finestra viene dal motore (#475)
  collegaScena(ipcMain, scene);
  const history = creaCronologiaScena((id) => scene.messaggi[id] ?? []);
  ipcMain.removeHandler('sessioni:messaggi');
  ipcMain.handle('sessioni:messaggi', (_e, id, pagina, opzioni) => history.pagina(id, pagina, opzioni));
  const preferenze = [];
  ipcMain.removeHandler('sessioni:imposta-preferenze');
  ipcMain.handle('sessioni:imposta-preferenze', (_e, id, parte) => { preferenze.push({ id, parte }); });
  const comandi = [];
  let esito = 'scaduto';
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { id: 'c', esito, testo: '', ...(esito === 'scaduto' ? { preso: false } : {}) }; });

  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  let showEvents = 0, focusEvents = 0;
  win.on('show', () => showEvents++);
  win.on('focus', () => focusEvents++);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const run = (fn, ...args) => win.webContents.executeJavaScript(`(${fn})(...${JSON.stringify(args)})`);
  const wait = (fn) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => { if ((${fn})()) resolve(); else if (Date.now() > end) reject(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn))})); else setTimeout(tick, 20); };
    tick();
  })`);
  const load = async () => {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: 's1' } });
    await wait(() => !!document.querySelector('.area-casella textarea') && !!document.querySelector('.chip-menu'));
  };
  // scrive come l'utente: valore, cursore in fondo, evento input
  const scrivi = (testo) => run((testo) => {
    const el = document.querySelector('.area-casella textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, testo);
    el.setSelectionRange(testo.length, testo.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, testo);
  const tasto = (key, extra = {}) => run((key, extra) => document.querySelector('.area-casella textarea').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra })), key, extra);
  const valore = () => run(() => document.querySelector('.area-casella textarea').value);
  const testi = (sel) => run((sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim()), sel);
  const clicca = (sel, testo) => run((sel, testo) => [...document.querySelectorAll(sel)].find((e) => !testo || e.textContent.includes(testo)).click(), sel, testo);
  const attendi = async (fn) => { const fine = Date.now() + 5000; while (!fn()) { if (Date.now() > fine) throw new Error('Attesa scaduta: ' + fn); await new Promise((r) => setTimeout(r, 20)); } };
  const failures = [];
  const check = async (name, test) => { try { await test(); console.log(`${name}: OK`); } catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); } };
  try {
    await check('SLASH_MENU', async () => {
      await load(); await scrivi('/co');
      await wait(() => document.querySelectorAll('.suggerimenti .voce').length === 4);
      assert.deepEqual(await testi('.suggerimenti .comando'), ['/compact', '/context', '/cost', '/code-review']);
      assert.equal((await testi('.suggerimenti .titolo-gruppo'))[0], 'Comandi');
      await tasto('ArrowDown'); await tasto('Enter');
      assert.equal(await valore(), '/context ');
      await wait(() => !document.querySelector('.suggerimenti'));
      assert.equal(comandi.length, 0, 'scegliere dal menu non manda niente');
    });
    await check('SLASH_FULL_COMMAND_SENDS', async () => {
      await load(); await scrivi('/cost');
      await wait(() => !!document.querySelector('.suggerimenti'));
      await tasto('Enter');
      await attendi(() => comandi.length === 1);
      assert.equal(comandi[0].cmd, 'manda'); assert.equal(comandi[0].args.testo, '/cost');
    });
    await check('SLASH_ESCAPE_CLOSES', async () => {
      await load(); await scrivi('/co'); await wait(() => !!document.querySelector('.suggerimenti'));
      await tasto('Escape'); await wait(() => !document.querySelector('.suggerimenti'));
      assert.equal(await valore(), '/co');
    });
    await check('FILE_MENU', async () => {
      await load(); await scrivi('Guarda @lett');
      await wait(() => document.querySelectorAll('.suggerimenti .voce').length === 3);
      assert.equal((await testi('.suggerimenti .titolo-gruppo'))[0], 'File');
      await clicca('.suggerimenti .voce', 'lettore.test');
      assert.equal(await valore(), 'Guarda @sessioni/src/lettore.test.ts ');
      await wait(() => !document.querySelector('.suggerimenti'));
    });
    await check('PERMESSI_CHIP', async () => {
      await load();
      assert.equal(await run(() => document.querySelector('.chip-menu .chip').textContent.trim()), 'Chiedi approvazione');
      await clicca('.chip-menu button.chip[aria-label="Permessi"]');
      await wait(() => document.querySelectorAll('.menu-casella.flottante .voce').length === 4);
      assert.equal(await run(() => document.querySelector('.menu-casella .voce.scelta .etichetta').textContent), 'Chiedi approvazione');
      await clicca('.menu-casella .voce', 'Solo piano');
      assert.deepEqual(preferenze.at(-1), { id: 's1', parte: { permessi: 'plan' } });
      await wait(() => !document.querySelector('.menu-casella'));
    });
    await check('MODELLO_CHIP', async () => {
      await load();
      assert.equal(await run(() => document.querySelectorAll('.chip-menu')[1].textContent.trim()), 'Fable 5.1Medio'); // la scelta di questa chat, non quella della trascrizione
      await clicca('.chip-menu button.chip[aria-label="Modello e sforzo"]');
      await wait(() => document.querySelectorAll('.menu-casella .tacca').length === 5);
      assert.deepEqual(await testi('.menu-casella .tacca .livello'), ['Basso', 'Medio', 'Alto', 'Molto alto', 'Massimo']);
      await clicca('.menu-casella .tacca', 'Alto'); // il menu resta aperto per le tacche
      assert.deepEqual(preferenze.at(-1), { id: 's1', parte: { sforzo: 'high' } });
      await clicca('.menu-casella button[role="switch"]');
      assert.deepEqual(preferenze.at(-1), { id: 's1', parte: { rapida: true } });
      await clicca('.menu-casella .voce', 'Sonnet 5.5');
      assert.deepEqual(preferenze.at(-1), { id: 's1', parte: { modello: 'claude-sonnet-5-5' } });
      await clicca('.chip-menu button.chip[aria-label="Modello e sforzo"]');
      await wait(() => !!document.querySelector('.menu-casella'));
      await clicca('.menu-casella .voce', 'Reimposta');
      assert.deepEqual(preferenze.at(-1), { id: 's1', parte: { modello: null, sforzo: null, rapida: null } });
    });
    await check('CONTESTO_TOOLTIP', async () => {
      await load();
      assert.equal(await run(() => document.querySelector('.con-suggerimento.contesto .chip').textContent.trim()), '62%');
      assert.equal(await run(() => document.querySelector('.con-suggerimento.contesto .suggerimento').textContent), 'Contesto usato: 62%');
    });
    await check('SEND_CARRIES_CHAT_MODEL', async () => {
      comandi.length = 0; esito = 'ok';
      await load(); await scrivi('Vai avanti');
      await clicca('button[aria-label="Invia"]');
      await attendi(() => comandi.length === 1);
      assert.deepEqual(comandi[0], { cmd: 'manda', args: { chat: 's1', testo: 'Vai avanti', modo: 'subito', modello: 'claude-fable-5-1' } });
    });
    await check('NON_INVIATO_E_RIPROVA', async () => {
      comandi.length = 0; esito = 'scaduto';
      await load(); await scrivi('Aggiungi lo stato con 200 sessioni');
      await clicca('button[aria-label="Invia"]');
      await wait(() => !!document.querySelector('.errore-invio'));
      assert.equal(await run(() => document.querySelector('.errore-invio .testo').textContent), 'Non inviato: la sessione non risponde.');
      assert.equal(await valore(), 'Aggiungi lo stato con 200 sessioni', 'il testo resta nella casella');
      assert.ok(await run(() => document.querySelector('.casella').classList.contains('errore')));
      assert.equal(await run(() => !!document.querySelector('.avviso, .avvisi .avviso')), false, 'nessun avviso a comparsa: il perché sta sotto la casella');
      esito = 'ok';
      await clicca('.errore-invio button', 'Riprova');
      await attendi(() => comandi.length === 2);
      await wait(() => !document.querySelector('.errore-invio'));
      assert.equal(comandi[1].args.testo, 'Aggiungi lo stato con 200 sessioni');
      await wait(() => document.querySelector('.area-casella textarea').value === '');
    });
    assert.deepEqual(failures, []);
    assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false);
    assert.equal(showEvents, 0); assert.equal(focusEvents, 0); assert.equal(win.webContents.isAudioMuted(), true);
    console.log(`CASELLA_OK show=${showEvents} focus=${focusEvents}`); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
