// #471: la casella cresce fino a misura/casella-testo-max e poi scorre; barra disegnata; bottone premuto.
// Lancio: npm run build && CLOTCH_TEST_SILENT=1 npx electron test/casella-scorrimento.dom.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  collegaScena(ipcMain, require('../design/scene/101-8036.json'));
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'clotch-ai' } });
    await win.webContents.executeJavaScript(`new Promise((r) => { const t = () => document.querySelector('.area-casella textarea') ? r() : setTimeout(t, 20); t(); })`);
    const r = await run(async () => {
      const a = document.querySelector('.area-casella textarea');
      const max = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--misura-casella-testo-max'));
      const set = (v) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(a, v); a.dispatchEvent(new Event('input', { bubbles: true })); return new Promise((ok) => setTimeout(ok, 50)); };
      await set('riga\n'.repeat(120));
      const lungo = { alto: a.getBoundingClientRect().height, scroll: a.scrollHeight, overflow: getComputedStyle(a).overflowY, dentro: a.getBoundingClientRect().bottom <= innerHeight };
      await set('una riga');
      const corto = a.getBoundingClientRect().height;
      const barra = getComputedStyle(a, '::-webkit-scrollbar').width;
      const premuto = [...document.styleSheets].some((s) => [...s.cssRules].some((x) => /button:active/.test(x.cssText)));
      return { max, lungo, corto, barra, premuto };
    });
    console.log('CASELLA', JSON.stringify(r));
    assert.equal(r.lungo.alto, r.max);
    assert.ok(r.lungo.scroll > r.max && r.lungo.overflow === 'auto' && r.lungo.dentro);
    assert.ok(r.corto < r.max);
    assert.equal(r.barra, '6px');
    assert.ok(r.premuto);
    console.log('CASELLA_SCORRIMENTO_OK');
    app.exit(0);
  } catch (e) { console.error(e); app.exit(1); }
});
