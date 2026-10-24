// Aspetto (#1091 #1092 #1090): dimensione del testo sposta tutta la scala, densità tocca solo la barra laterale,
// un interruttore acceso premuto resta acceso. Finestra invisibile e muta, scena 101-8036.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  collegaScena(ipcMain, require(path.join(root, 'design/scene/101-8036.json')));
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 900, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'));
    for (let i = 0; i < 200 && !(await run(() => !!document.querySelector('.barra-laterale .riga'))); i++) await new Promise((r) => setTimeout(r, 25));
    // una pagina di prova con le classi di testo, una voce di menu e un interruttore acceso
    await run(() => { document.body.insertAdjacentHTML('beforeend', '<div id="prova"><span class="t-xs">a</span><span class="t-sm">b</span><span class="t-base">c</span><span class="t-lg">d</span><div class="menu"><button class="voce">v</button></div><button type="button" role="switch" aria-checked="true" class="interruttore acceso"><span class="manopola"></span></button></div>'); return 0; });
    const misura = (d, n) => run(`() => { const r = document.documentElement; r.dataset.dimensione = '${d}'; r.dataset.densita = '${n}';
      const px = (s) => parseFloat(getComputedStyle(document.querySelector('#prova ' + s)).fontSize);
      return { xs: px('.t-xs'), sm: px('.t-sm'), base: px('.t-base'), lg: px('.t-lg'), barra: document.querySelector('.barra-laterale .riga').getBoundingClientRect().height,
        voce: parseFloat(getComputedStyle(document.querySelector('#prova .menu .voce')).height) || document.querySelector('#prova .menu .voce').getBoundingClientRect().height }; }`);
    const media = await misura('media', 'normale'), piccola = await misura('piccola', 'compatta'), grande = await misura('grande', 'ariosa');
    console.log('ASPETTO', JSON.stringify({ media, piccola, grande }));
    for (const [nome, m] of Object.entries({ media, piccola, grande })) assert.ok(m.xs <= m.sm && m.sm < m.base && m.base < m.lg, `${nome}: la scala resta in ordine ${JSON.stringify(m)}`);
    assert.ok(piccola.base < media.base && grande.base > media.base && piccola.sm < media.sm && grande.lg > media.lg, 'tutta la scala si sposta');
    assert.ok(piccola.barra < media.barra && grande.barra > media.barra, 'la densità cambia le righe della barra');
    assert.equal(piccola.voce, media.voce); assert.equal(grande.voce, media.voce);
    // premuto: :active non si emula, si legge se la regola del premuto generico tocca l'interruttore
    const premuto = await run(() => [...document.styleSheets].flatMap((f) => [...f.cssRules]).filter((r) => r.selectorText?.startsWith('button:active')).some((r) => document.querySelector('#prova .interruttore').matches(r.selectorText.replace(/:active/g, ''))));
    assert.equal(premuto, false, 'il premuto generico non tocca l\'interruttore acceso');
    console.log('ASPETTO_OK');
  } catch (e) { console.error(e); process.exitCode = 1; }
  app.quit();
});
