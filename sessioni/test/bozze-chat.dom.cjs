// Renderer reale con IPC intercettato: nessun dato o comando reale.
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
  const scene = require('../design/scene/101-14849.json');
  const a = scene.elenco.sessioni[0];
  a.titolo = 'Bozza A';
  scene.elenco.sessioni.push({ ...a, id: 's2', titolo: 'Bozza B' });
  scene.messaggi.s1 = [{ tipo: 'utente', testo: 'Messaggio A v1', t: null }];
  scene.messaggi.s2 = [{ tipo: 'utente', testo: 'Messaggio B v1', t: null }];
  const chat = scene.registro.chat.s1;
  chat.battito = Date.now();
  chat.coda = [{ voce: 'v1', testo: 'Coda A uno' }, { voce: 'v2', testo: 'Coda A due' }];
  scene.registro.chat.s2 = { ...chat, chat: 's2', coda: [{ voce: 'v1', testo: 'Coda B uno' }] };
  collegaScena(ipcMain, scene);
  const history = creaCronologiaScena((id) => scene.messaggi[id] ?? []);
  let historyReads = 0;
  ipcMain.removeHandler('sessioni:messaggi');
  ipcMain.handle('sessioni:messaggi', (_event, id, pagina, opzioni) => {
    assert.equal(opzioni?.v, 1, 'chat reale richiede snapshot v1');
    const p = history.pagina(id, pagina, opzioni);
    assert.equal(p.cronologia?.sessione, id); historyReads++; return p;
  });
  ipcMain.removeHandler('clotch-ai:comando');
  let pending = null;
  const commands = [];
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => {
    commands.push({ cmd, args });
    return new Promise((resolve) => { pending = (esito = 'ok') => { pending = null; resolve({ esito }); }; });
  });
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  let showEvents = 0, focusEvents = 0;
  win.on('show', () => showEvents++);
  win.on('focus', () => focusEvents++);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const hidden = () => {
    assert.equal(win.isVisible(), false, 'finestra mai visibile');
    assert.equal(win.isFocused(), false, 'finestra mai attiva');
    assert.equal(win.webContents.isAudioMuted(), true, 'audio renderer sempre muto');
    assert.equal(showEvents, 0, 'nessun evento show');
    assert.equal(focusEvents, 0, 'nessun evento focus');
  };
  hidden();
  const run = (fn, ...args) => win.webContents.executeJavaScript(`(${fn})(...${JSON.stringify(args)})`);
  const wait = (fn) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => { if ((${fn})()) resolve(); else if (Date.now() > end) reject(new Error('Attesa DOM scaduta')); else setTimeout(tick, 20); };
    tick();
  })`);
  const load = async () => { await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: 's1' } }); await wait(() => !!document.querySelector('.area-casella textarea') && document.querySelector('.messaggio-roberto .bolla')?.textContent === 'Messaggio A v1'); };
  const type = (text) => run((text) => {
    const el = document.querySelector('.area-casella textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  const value = () => run(() => document.querySelector('.area-casella textarea').value);
  const select = async (title) => {
    await run((title) => [...document.querySelectorAll('.riga')].find((el) => el.querySelector('.testo')?.textContent === title).click(), title);
    const expected = title === 'Bozza A' ? 'Messaggio A v1' : 'Messaggio B v1';
    await wait(() => !!document.querySelector('.area-casella textarea'));
    assert.equal(await run(() => document.querySelector('.messaggio-roberto .bolla')?.textContent), expected);
  };
  const edit = (index = 0) => run((i) => document.querySelectorAll('.messaggio-in-coda button[aria-label="Modifica"]')[i].click(), index);
  const escape = () => run(() => document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  const failures = [];
  const check = async (name, test) => { try { await test(); console.log(`${name}: OK`); } catch (e) { failures.push(`${name}: ${e.message}`); console.error(`${name}: FAIL ${e.message}`); } };
  try {
    await check('DRAFT_TWO_CHATS', async () => {
      await load(); await type('Testo A'); await select('Bozza B'); assert.equal(await value(), '');
      await type('Testo B'); await select('Bozza A'); assert.equal(await value(), 'Testo A');
      await select('Bozza B'); assert.equal(await value(), 'Testo B');
    });
    await check('DRAFT_SETTINGS_BACK', async () => {
      await load(); await type('Dopo impostazioni');
      await run(() => document.querySelector('button[aria-label="Impostazioni"]').click());
      await wait(() => !!document.querySelector('.nav-impostazioni'));
      await run(() => document.querySelector('button[aria-label="Indietro"]').click());
      await wait(() => !!document.querySelector('.area-casella textarea'));
      assert.equal(await value(), 'Dopo impostazioni');
    });
    await check('DRAFT_QUEUE_CHAT_AND_ITEM', async () => {
      await load(); await type('Bozza normale'); await edit(); await type('Modifica A uno');
      await select('Bozza B'); assert.equal(await value(), '');
      await edit(); assert.equal(await value(), 'Coda B uno'); await type('Modifica B uno');
      await select('Bozza A'); assert.equal(await value(), 'Modifica A uno');
      await edit(); assert.equal(await value(), 'Coda A due'); await type('Modifica A due');
      await escape(); assert.equal(await value(), 'Bozza normale');
      await edit(); assert.equal(await value(), 'Modifica A uno');
      await select('Bozza B'); assert.equal(await value(), 'Modifica B uno');
    });
    await check('DRAFT_LATE_SEND', async () => {
      await load(); await type('Invia A');
      await run(() => document.querySelector('button[aria-label="Invia"]').click());
      await type('Nuovo testo A'); await select('Bozza B'); await type('Nuovo testo B');
      assert.equal(await run(() => document.querySelector('button[aria-label="Invia"]').disabled), false, 'B non eredita invio pendente di A');
      assert.ok(pending, 'invio intercettato'); pending();
      await wait(() => !document.querySelector('button[aria-label="Invia"]')?.disabled);
      assert.equal(await value(), 'Nuovo testo B'); await select('Bozza A'); assert.equal(await value(), 'Nuovo testo A');
      assert.deepEqual(commands.at(-1), { cmd: 'manda', args: { chat: 's1', testo: 'Invia A', modo: 'subito' } });
    });
    await check('DRAFT_SEND_SUCCESS_AND_FAILURE', async () => {
      await load(); await type('Messaggio concluso');
      await run(() => document.querySelector('button[aria-label="Invia"]').click());
      assert.ok(pending); pending();
      await wait(() => document.querySelector('.area-casella textarea').value === '');
      await type('Messaggio fallito');
      await run(() => document.querySelector('button[aria-label="Invia"]').click());
      assert.ok(pending); pending('errore');
      await wait(() => !document.querySelector('button[aria-label="Invia"]')?.disabled);
      assert.equal(await value(), 'Messaggio fallito');
    });
    await check('DRAFT_QUEUE_LATE_SAVE', async () => {
      await load(); await type('Bozza fuori coda'); await edit(); await type('Salva A uno');
      await run(() => document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })));
      await type('Altro testo A uno'); await select('Bozza B'); await edit(); await type('Altro testo B uno');
      assert.ok(pending); pending();
      assert.deepEqual(commands.at(-1), { cmd: 'coda_modifica', args: { chat: 's1', voce: 'v1', testo: 'Salva A uno' } });
      await select('Bozza A');
      await wait(() => !document.querySelector('button[aria-label="Invia"]')?.disabled);
      assert.equal(await value(), 'Altro testo A uno');
      await escape(); assert.equal(await value(), 'Bozza fuori coda');
      await edit();
      await run(() => document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })));
      assert.ok(pending); pending();
      await wait(() => !document.querySelector('.nota-casella'));
      assert.equal(await value(), 'Bozza fuori coda');
      await select('Bozza B'); assert.equal(await value(), 'Altro testo B uno');
    });
    assert.deepEqual(failures, []);
    assert.ok(historyReads >= 2, 'entrambe le chat hanno letto veri messaggi v1');
    console.log('DRAFT_V1_MESSAGE_CONTENT_OK');
    hidden(); console.log('HIDDEN_WINDOW_OK shows=0 focus=0');
    console.log('DRAFT_ISOLATION_OK'); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
