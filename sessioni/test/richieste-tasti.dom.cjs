// Richieste nel filo come un alert del Mac (#855): Esc nella carta nega il permesso o salta la domanda; dopo la risposta il fuoco torna alla casella.
// Lancio: npm run build && CLOTCH_TEST_SILENT=1 npx electron test/richieste-tasti.dom.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  // permesso (101-13650) e domanda (101-13896): un registro con le due richieste, la domanda viene dalla trascrizione
  const scene = structuredClone(require('../design/scene/101-13896.json'));
  scene.registro.chat.s1.richieste.unshift(require('../design/scene/101-13650.json').registro.chat.s1.richieste[0]);
  collegaScena(ipcMain, scene);
  const comandi = [];
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { id: 'c', esito: 'ok', testo: '' }; });
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 900, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));
  // Esc sul pezzo `sel` della carta con titolo `titolo`
  const esc = (titolo, sel) => run(new Function(`return () => { const c = [...document.querySelectorAll('.carta-richiesta')].find((x) => x.querySelector('.titolo').textContent === ${JSON.stringify(titolo)}); const b = c.querySelector(${JSON.stringify(sel)}); b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }`)());
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: 's1' } });
    await win.webContents.executeJavaScript(`new Promise((r) => { const t = () => document.querySelectorAll('.carta-richiesta').length === 2 ? r() : setTimeout(t, 20); t(); })`);
    await esc('Permesso richiesto', '.bottoni button');
    await attendi(300);
    const dopo = await run(() => ({ esito: [...document.querySelectorAll('.esito-richiesta .esito')].map((x) => x.textContent).join(), fuoco: document.activeElement?.tagName, casella: document.activeElement?.closest('.area-casella') !== null }));
    console.log('PERMESSO', JSON.stringify(comandi.at(-1)), JSON.stringify(dopo));
    assert.deepEqual([comandi.at(-1).cmd, comandi.at(-1).args.scelta], ['rispondi_permesso', 'nega']);
    assert.equal(dopo.esito, 'Negato da te');
    assert.ok(dopo.fuoco === 'TEXTAREA' && dopo.casella, 'il fuoco torna alla casella');
    // Esc nel campo con testo non salta: si perderebbe la risposta scritta
    await run(() => { const i = document.querySelector('.carta-richiesta input.altro'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'staging'); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await esc('Domanda per te', 'input.altro');
    await attendi(200);
    assert.equal(comandi.length, 1, 'Esc nel campo scritto non manda niente');
    await esc('Domanda per te', '.opzione');
    await attendi(300);
    console.log('DOMANDA', JSON.stringify(comandi.at(-1)));
    assert.equal(comandi.at(-1).cmd, 'salta_domanda');
    console.log('RICHIESTE OK');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { app.quit(); }
});
