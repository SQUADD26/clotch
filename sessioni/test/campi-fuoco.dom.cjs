// Campi e focus (#521): ogni campo con il focus non disegna un suo rettangolo; il bordo è del contenitore e ne segue il raggio.
// Serve uno schermo (xvfb-run -a electron test/campi-fuoco.dom.cjs): :focus-visible non scatta in una finestra nascosta.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const scene = JSON.parse(JSON.stringify(require('../design/scene/101-8036.json')));
scene.navigazione = { vista: 'sessione', sessione: scene.elenco.sessioni[0].id };
const att = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  const win = new BrowserWindow({ show: true, width: 1440, height: 900, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: scene.elenco.sessioni[0].id } });
  await att(1200);
  win.webContents.focus();
  const js = (s) => win.webContents.executeJavaScript(s);
  // ⌘K: il campo grande col fuoco non ha outline suo
  await js(`document.querySelector('.cerca-barra, button[aria-label*="Cerca"], .voce-cerca')?.click()`);
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))`);
  await att(400);
  const grande = await js(`(() => { const i = document.querySelector('[role=dialog] input'); i.focus(); return getComputedStyle(i).outlineStyle; })()`);
  assert.equal(grande, 'none', 'Cerca sessioni: il campo non disegna il suo rettangolo');
  // l'input di un campo piccolo: bordo sul contenitore, stesso raggio, mai doppio
  const r = await js(`(() => { document.body.insertAdjacentHTML('beforeend', '<label class="campo piccolo" id="p" style="position:fixed;top:0"><input id="pi"></label>'); document.getElementById('pi').focus();
    const i = getComputedStyle(document.getElementById('pi')), c = getComputedStyle(document.getElementById('p')); return [i.outlineStyle, c.outlineStyle, c.borderRadius, c.outlineOffset]; })()`);
  assert.equal(r[0], 'none'); assert.equal(r[1], 'solid'); assert.notEqual(r[2], '0px');
  console.log('CAMPI_FUOCO_OK');
  app.exit(0);
}).catch((e) => { console.error(e); app.exit(1); });
