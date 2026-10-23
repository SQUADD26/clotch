// Prova il renderer vero con IPC della scena: nessun dato o comando reale del Mac.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  collegaScena(ipcMain, { registro: {
    comandi: [{ cmd: 'parla', id: 'dom-domanda', t: 1, args: { testo: 'Mostra il lavoro in corso' } }],
    avvisi: [{ motivo: 'risposta', id: 'dom-risposta', t: 2, testo: 'Controllo le sessioni aperte.', sessioni: [] }],
  } });
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  const ready = (selector) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => document.querySelector(${JSON.stringify(selector)}) ? resolve() : Date.now() > end ? reject(new Error('Elemento assente: ' + ${JSON.stringify(selector)})) : setTimeout(tick, 20);
    tick();
  })`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'friday' } });
    await ready('.area-casella textarea');
    await ready('.risposta-friday .risposta');
    const styles = await run(() => Object.fromEntries(['.filo', '.area-casella', '.casella', '.messaggio-roberto', '.risposta-friday', '.risposta'].map((q) => [q, getComputedStyle(document.querySelector(q)).display])));
    const failures = [];
    for (const [selector, display] of Object.entries(styles)) {
      console.log(`CHAT_STYLE ${selector}: ${display}`);
      if (display !== 'flex') failures.push(`${selector}: atteso flex, ricevuto ${display}`);
    }
    await run(() => document.querySelector('button[aria-label="Impostazioni"]').click());
    await ready('.nav-impostazioni');
    await run(() => [...document.querySelectorAll('.nav-impostazioni button')].find((b) => b.textContent === 'Aspetto').click());
    await ready('.nav-impostazioni button[aria-current="page"]');
    await run(() => [...document.querySelectorAll('.nav-impostazioni button')].find((b) => b.textContent === 'Generale').click());
    await run(() => document.querySelector('button[aria-label="Indietro"]').click());
    const back = await run(() => !document.querySelector('.nav-impostazioni') && !!document.querySelector('.area-casella textarea'));
    console.log(`SETTINGS_BACK_FIRST_CLICK: ${back}`);
    if (!back) failures.push('Indietro non torna alla chat dopo cambi sezione');
    assert.deepEqual(failures, []);
    await run(() => document.querySelector('button[aria-label="Avanti"]').click());
    await ready('.nav-impostazioni');
    assert.equal(await run(() => document.querySelector('.nav-impostazioni button[aria-current="page"]').textContent), 'Generale');
    await run(() => document.querySelector('button[aria-label="Indietro"]').click());
    await ready('.area-casella textarea');
    console.log('SETTINGS_FORWARD_LAST_SECTION: Generale');
    // Il prefisso chat rimane confinato ai componenti condivisi.
    assert.equal(await run(() => !!document.querySelector('.pezzo-barra .pezzo-chat')), false);
    console.log('CHAT_NAV_DOM_OK');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
