// Hook reale montato con React/Electron; IPC differito, nessun dato del Mac.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(root, '.async-chat-'));
const pending = [];
let win;
const page = (text, pagina = 0, haAltre = false) => ({ messaggi: [{ tipo: 'utente', testo: text, t: pagina }], pagina, haAltre, totale: 3, errore: null });
ipcMain.handle('sessioni:messaggi', (_event, id, pagina) => new Promise((resolve) => pending.push({ id, pagina, resolve })));
const wait = async (fn, label) => {
  const end = Date.now() + 5000;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error('Timeout: ' + label);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
app.whenReady().then(async () => {
  try {
    const entry = path.join(temp, 'entry.jsx');
    fs.writeFileSync(entry, `import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { useMessaggi } from '../src/ui/base/dati.ts';
      let current = 'A'; const root = createRoot(document.getElementById('root'));
      function Probe() { const m = useMessaggi(current); window.probe = m;
        return React.createElement('pre', null, JSON.stringify(m)); }
      window.mount = (id) => { current = id; root.render(React.createElement(Probe)); };
      window.settings = () => root.render(React.createElement('p', null, 'settings'));
      window.mount('A');`);
    const { build } = await import('vite');
    await build({ root, configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, build: { outDir: path.join(temp, 'out'),
      lib: { entry, name: 'Probe', formats: ['iife'], fileName: () => 'probe.js' } } });
    fs.writeFileSync(path.join(temp, 'index.html'), '<div id="root"></div><script src="out/probe.js"></script>');
    win = new BrowserWindow({ show: false, focusable: false, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
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
    win.webContents.on('console-message', (details) => { if (details.level === 'error') console.error(details.message); });
    const run = (code) => win.webContents.executeJavaScript(code);
    const requests = (n) => wait(() => pending.length >= n, n + ' richieste IPC');
    const text = () => run('window.probe.messaggi.map(m => m.testo).join("|")');
    const settle = async (request, result) => { request.resolve(result); await run('new Promise(r => setTimeout(r, 40))'); };
    await win.loadFile(path.join(temp, 'index.html'));
    await requests(1);
    await run('mount("B")'); await requests(2);
    await settle(pending[1], page('B recente', 0, true));
    await settle(pending[0], page('A tardiva'));
    assert.equal(await text(), 'B recente', 'A lenta non può sostituire B');
    console.log('ASYNC_SWITCH_OK');
    await run('probe.altri(); probe.altri(); probe.altri();'); await requests(3);
    assert.equal(pending.length, 3, 'richieste equivalenti coalescenti nello stesso giro');
    assert.equal(pending[2].pagina, 1);
    await run('mount("C")'); await requests(4);
    await settle(pending[3], page('C recente'));
    await settle(pending[2], page('B precedente', 1));
    assert.equal(await text(), 'C recente', 'pagina precedente tardiva isolata');
    console.log('ASYNC_PREVIOUS_AND_COALESCING_OK');
    await run('probe.riprova(); probe.riprova()'); await requests(6);
    await settle(pending[5], page('C nuovo'));
    await settle(pending[4], page('C vecchio'));
    assert.equal(await text(), 'C nuovo', 'stessa sessione: vince ultima generazione');
    console.log('ASYNC_REFRESH_GENERATION_OK');
    await run('probe.riprova()'); await requests(7);
    await run('settings()'); await run('mount("C")'); await requests(8);
    await settle(pending[7], page('C riaperta'));
    await settle(pending[6], page('C smontata'));
    assert.equal(await text(), 'C riaperta', 'smontaggio e ritorno dalle impostazioni');
    console.log('ASYNC_REMOUNT_OK');
    // Un finally vecchio non deve sbloccare la richiesta della nuova conversazione.
    await run('probe.riprova()'); await requests(9);
    await settle(pending[8], page('C con pagine', 0, true));
    await run('void probe.altri()'); await requests(10);
    await run('mount("D")'); await requests(11);
    await settle(pending[10], page('D recente', 0, true));
    await run('void probe.altri()'); await requests(12);
    await settle(pending[9], { ...page('C errore', 1), errore: 'errore precedente' });
    assert.equal(await run('probe.altriCarica'), true, 'finally vecchio non sblocca richiesta nuova');
    assert.equal(await run('probe.stato'), 'pronto', 'errore vecchio non cambia stato nuovo');
    await run('void probe.altri()');
    assert.equal(pending.length, 12, 'il blocco della pagina nuova resta attivo');
    await settle(pending[11], page('D precedente', 1));
    assert.equal(await text(), 'D precedente|D recente');
    assert.equal(await run('probe.altriCarica'), false);
    console.log('ASYNC_OLD_FINALLY_OK');
    await run('probe.riprova()'); await requests(13);
    await settle(pending[12], { ...page('errore'), errore: 'messaggi non disponibili' });
    assert.equal(await run('probe.stato'), 'errore');
    assert.equal(await run('probe.errore'), 'messaggi non disponibili');
    await run('probe.riprova()'); await requests(14);
    await settle(pending[13], page('D ripresa'));
    assert.equal(await text(), 'D ripresa');
    console.log('ASYNC_ERROR_RETRY_OK');
    console.log('ASYNC_CHAT_ISOLATION_OK');
    hidden(); console.log('HIDDEN_WINDOW_OK shows=0 focus=0');
    win.destroy(); fs.rmSync(temp, { recursive: true, force: true }); app.exit(0);
  } catch (error) {
    console.error(error); if (win) win.destroy(); fs.rmSync(temp, { recursive: true, force: true }); app.exit(1);
  }
});
