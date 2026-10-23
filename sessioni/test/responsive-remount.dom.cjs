// Renderer e IPC della scena: nessun registro o comando reale del Mac.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const scene = require(path.join(root, 'design/scene/101-8036.json'));

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  const win = new BrowserWindow({ show: false, width: 1800, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
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
    await run(() => document.querySelector('button[aria-label="Impostazioni"]').click());
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
    await run(() => document.querySelector('button[aria-label="Impostazioni"]').click());
    await wait(() => !!document.querySelector('.nav-impostazioni'));
    win.setSize(1024, 1000);
    await run(() => document.querySelector('button[aria-label="Indietro"]').click());
    await wait(() => !!document.querySelector('.contenuto') && !document.querySelector('.pannello'));
    console.log('RESPONSIVE_REMOUNT_OK');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
