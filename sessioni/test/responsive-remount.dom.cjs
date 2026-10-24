// Renderer e IPC della scena: nessun registro o comando reale del Mac.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const scene = require(path.join(root, 'design/scene/101-8036.json'));
const { creaCronologiaScena } = require('../dist/src/scena-cronologia.js');
const sessionId = scene.navigazione.sessione;
scene.messaggi[sessionId] = [{ tipo: 'utente', testo: 'Messaggio responsive v1', t: null }];

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  const history = creaCronologiaScena((id) => scene.messaggi[id] ?? []);
  let historyReads = 0;
  ipcMain.removeHandler('sessioni:messaggi');
  ipcMain.handle('sessioni:messaggi', (_event, id, pagina, opzioni) => {
    assert.equal(opzioni?.v, 1); const p = history.pagina(id, pagina, opzioni);
    assert.equal(p.cronologia?.sessione, id); historyReads++; return p;
  });
  const win = new BrowserWindow({ show: false, focusable: false, width: 1800, height: 1000,
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
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  const wait = (check) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 1500;
    const test = ${check};
    const tick = () => test() ? resolve() : Date.now() > end ? reject(new Error('Condizione UI non raggiunta')) : setTimeout(tick, 20);
    tick();
  })`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: scene.navigazione });
    await wait(() => !!document.querySelector('.pannello') && document.querySelector('.contenuto').getBoundingClientRect().width > 1200);
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'Messaggio responsive v1');
    await run(() => document.querySelector('.piede-account button[aria-label="Impostazioni"]').click());
    await wait(() => !!document.querySelector('[role=menu] .voce'));
    await run(() => [...document.querySelectorAll('[role=menu] .voce')].find((e) => e.textContent.startsWith('Impostazioni')).click());
    await wait(() => !!document.querySelector('.nav-impostazioni'));
    await run(() => document.querySelector('button[aria-label="Indietro"]').click());
    await wait(() => !!document.querySelector('.contenuto'));
    win.setSize(1024, 1000);
    try { await wait(() => !document.querySelector('.pannello')); } catch { /* esito esplicito sotto */ }
    const narrow = await run(() => !document.querySelector('.pannello'));
    console.log(`PANEL_AFTER_SETTINGS_1024: ${narrow ? 'hidden' : 'visible'}`);
    assert.equal(narrow, true, 'Il pannello deve seguire il nuovo nodo dopo le impostazioni');
    win.setSize(1800, 1000);
    await wait(() => !!document.querySelector('.pannello'));
    console.log('PANEL_AFTER_SETTINGS_1800: visible');
    await run(() => document.querySelector('.piede-account button[aria-label="Impostazioni"]').click());
    await wait(() => !!document.querySelector('[role=menu] .voce'));
    await run(() => [...document.querySelectorAll('[role=menu] .voce')].find((e) => e.textContent.startsWith('Impostazioni')).click());
    await wait(() => !!document.querySelector('.nav-impostazioni'));
    win.setSize(1024, 1000);
    await run(() => document.querySelector('button[aria-label="Indietro"]').click());
    await wait(() => !!document.querySelector('.contenuto') && !document.querySelector('.pannello'));
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'Messaggio responsive v1');
    assert.ok(historyReads >= 3, 'snapshot v1 riletta dopo ciascun ritorno dalle impostazioni');
    console.log('RESPONSIVE_V1_MESSAGE_CONTENT_OK');
    hidden(); console.log('HIDDEN_WINDOW_OK shows=0 focus=0');
    console.log('RESPONSIVE_REMOUNT_OK');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
