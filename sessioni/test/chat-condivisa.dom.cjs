// Prova il renderer vero con IPC della scena: nessun dato o comando reale del Mac.
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
  const scene = require('../design/scene/101-8036.json');
  const sessionId = scene.elenco.sessioni[0].id;
  scene.messaggi[sessionId] = [{ tipo: 'utente', testo: 'Sessione reale v1 verificata', t: null }];
  scene.registro = {
    comandi: [{ cmd: 'parla', id: 'dom-domanda', t: 1, args: { testo: 'Mostra il lavoro in corso' } }],
    avvisi: [{ motivo: 'risposta', id: 'dom-risposta', t: 2, testo: 'Controllo le sessioni aperte.', sessioni: [] }],
  };
  collegaScena(ipcMain, scene);
  const history = creaCronologiaScena((id) => scene.messaggi[id] ?? []);
  let historyReads = 0;
  ipcMain.removeHandler('sessioni:messaggi');
  ipcMain.handle('sessioni:messaggi', (_event, id, pagina, opzioni) => {
    assert.equal(opzioni?.v, 1); const p = history.pagina(id, pagina, opzioni);
    assert.equal(p.cronologia?.sessione, id); historyReads++; return p;
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
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  const ready = (selector) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => document.querySelector(${JSON.stringify(selector)}) ? resolve() : Date.now() > end ? reject(new Error('Elemento assente: ' + ${JSON.stringify(selector)})) : setTimeout(tick, 20);
    tick();
  })`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'clotch-ai' } });
    await ready('.area-casella textarea');
    await ready('.risposta-clotch-ai .risposta');
    assert.equal(await run(() => document.querySelector('.messaggio-roberto .bolla').textContent), 'Mostra il lavoro in corso');
    assert.equal(await run(() => document.querySelector('.risposta-clotch-ai .testo-risposta').textContent), 'Controllo le sessioni aperte.');
    console.log('AI_SHARED_MESSAGE_CONTENT_OK');
    const styles = await run(() => Object.fromEntries(['.filo', '.area-casella', '.casella', '.messaggio-roberto', '.risposta-clotch-ai', '.risposta'].map((q) => [q, getComputedStyle(document.querySelector(q)).display])));
    const failures = [];
    for (const [selector, display] of Object.entries(styles)) {
      console.log(`CHAT_STYLE ${selector}: ${display}`);
      if (display !== 'flex') failures.push(`${selector}: atteso flex, ricevuto ${display}`);
    }
    for (const width of [1440, 1024]) {
      win.setSize(width, 1000);
      const sizes = await run(() => {
        const column = document.querySelector('.colonna').getBoundingClientRect();
        const expected = Math.min(column.width, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--misura-colonna')));
        return Object.fromEntries(['.filo', '.area-casella', '.casella'].map((q) => {
          const rect = document.querySelector(q).getBoundingClientRect();
          return [q, { width: rect.width, expected, center: rect.x + rect.width / 2, columnCenter: column.x + column.width / 2 }];
        }));
      });
      for (const [selector, size] of Object.entries(sizes)) {
        console.log(`CHAT_WIDTH ${width} ${selector}: ${size.width}, expected ${size.expected}`);
        if (Math.abs(size.width - size.expected) > 1 || Math.abs(size.center - size.columnCenter) > 1)
          failures.push(`${width} ${selector}: larghezza o centro diversi dalla colonna`);
      }
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
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: sessionId } });
    await ready('.messaggio-roberto .bolla');
    assert.equal(await run(() => document.querySelector('.messaggio-roberto .bolla').textContent), 'Sessione reale v1 verificata');
    assert.ok(historyReads > 0, 'sessione v1 letta realmente dal renderer');
    console.log('SESSION_SHARED_V1_CONTENT_OK');
    hidden(); console.log('HIDDEN_WINDOW_OK shows=0 focus=0');
    console.log('CHAT_NAV_DOM_OK');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
