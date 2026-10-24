// Coda dei messaggi (#652, #655, #856): oltre 4 voci scorre e il conto resta; ↵ a casella vuota manda la prima voce e la toglie.
// Lancio: npm run build && CLOTCH_TEST_SILENT=1 npx electron test/coda.dom.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  const scene = structuredClone(require('../design/scene/101-14849.json'));
  scene.registro.chat.s1.coda = Array.from({ length: 19 }, (_, i) => ({ voce: `v${i + 1}`, testo: `Messaggio ${i + 1}` }));
  collegaScena(ipcMain, scene);
  const comandi = [];
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { id: 'c', esito: 'ok', testo: '' }; });
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 900, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: 's1' } });
    await win.webContents.executeJavaScript(`new Promise((r) => { const t = () => document.querySelector('.coda .messaggio-in-coda') ? r() : setTimeout(t, 20); t(); })`);
    const r = await run(() => {
      const e = document.querySelector('.coda .elenco-coda'), c = document.querySelector('.coda .conto-coda');
      return { alto: e.getBoundingClientRect().height, scroll: e.scrollHeight, overflow: getComputedStyle(e).overflowY, conto: c?.textContent, righe: e.children.length };
    });
    console.log('CODA', JSON.stringify(r));
    assert.ok(r.alto < r.scroll && r.overflow === 'auto' && r.alto <= 4 * 48 + 3 * 4, 'la coda lunga scorre');
    assert.equal(r.conto, '19 messaggi in coda');
    await run(() => { const a = document.querySelector('.area-casella textarea'); a.focus(); a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await new Promise((ok) => setTimeout(ok, 300));
    console.log('COMANDI', JSON.stringify(comandi.map((c) => [c.cmd, c.args.voce ?? c.args.testo])));
    assert.deepEqual(comandi.map((c) => c.cmd), ['manda', 'coda_togli']);
    assert.equal(comandi[1].args.voce, 'v1');
    // Rimuovi lo dice e si annulla (#856)
    await run(() => document.querySelector('.coda .messaggio-in-coda [aria-label="Rimuovi"]').click());
    await new Promise((ok) => setTimeout(ok, 300));
    const avviso = await run(() => [...document.querySelectorAll('[data-avviso]')].map((a) => a.textContent).join('|'));
    console.log('AVVISO', avviso);
    assert.match(avviso, /Messaggio rimosso.*Annulla/);
    await run(() => [...document.querySelectorAll('[data-avviso] button')].find((b) => b.textContent === 'Annulla').click());
    await new Promise((ok) => setTimeout(ok, 300));
    assert.deepEqual(comandi.slice(2).map((c) => [c.cmd, c.args.modo ?? c.args.voce]), [['coda_togli', 'v1'], ['manda', 'coda']]);
    console.log('CODA OK');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { app.quit(); }
});
