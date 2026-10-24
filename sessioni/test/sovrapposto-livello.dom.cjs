// Livello dei sovrapposti durante una View Transition (#1144): il menu del filtro con le caselle deve restare sopra alle colonne
// anche nei fotogrammi del cambio di stato. Finestra visibile sotto xvfb con il fuoco, muta. Stampa «SOV livello …» e SOVRAPPOSTO_OK.
// Prova: foto del menu a riposo, foto 90 ms dopo il clic su una casella (transizione in corso), foto a fine; dove il menu era coperto
// dalla colonna la foto in corsa differisce da quella a riposo per molti pixel. Con SOV_SENZA_FIX=1 si toglie la regola e il difetto si vede.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_e, c) => c.setAudioMuted(true));
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const scene = require(path.join(root, 'design/scene/101-8036.json'));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  const win = new BrowserWindow({ show: true, width: 1440, height: 900, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true, backgroundThrottling: false } });
  const run = (fn) => win.webContents.executeJavaScript(typeof fn === 'string' ? fn : `(${fn})()`);
  const wait = async (test, ms = 8000) => { const fine = Date.now() + ms; while (!(await run(test))) { if (Date.now() > fine) throw new Error('Condizione UI non raggiunta: ' + test); await pausa(20); } };
  const clicVoce = (t) => run(`(() => { [...document.querySelectorAll('.sovrapposto .voce, .barra-laterale button.riga')].find((b) => b.textContent.includes(${JSON.stringify(t)})).click(); return 0; })()`);
  const foto = async (r) => (await win.webContents.capturePage({ x: r.x, y: r.y, width: r.width, height: r.height })).toBitmap();
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'));
    win.focus(); win.webContents.focus();
    await wait(() => !!document.querySelector('.barra-laterale .riga') && document.hasFocus());
    if (process.env.SOV_SENZA_FIX) await run(() => { document.head.append(Object.assign(document.createElement('style'), { textContent: '.sovrapposto,.velo{view-transition-name:none!important}' })); return 0; });
    await clicVoce('Filtra'); await wait(() => !!document.querySelector('.menu-raggruppa'));
    await clicVoce('Aggiungi filtro'); await wait(() => !!document.querySelector('.menu-filtro'));
    await clicVoce('Stato'); await wait(() => !!document.querySelector('.menu-filtro [role=menuitemcheckbox]'));
    await pausa(500);
    const r = await run(() => { const b = document.querySelector('.menu-filtro').getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) }; });
    const nome = await run(() => getComputedStyle(document.querySelector('.menu-filtro')).viewTransitionName);
    const riposo = await foto(r);
    const conta = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n; };
    // un cambio di struttura al clic sulla casella: setVista -> conTransizione; il menu non deve cambiare posto né sparire
    await run(() => { document.querySelector('.menu-filtro [role=menuitemcheckbox]').click(); return 0; });
    const corsa = [];
    for (const ms of [30, 60, 90, 120]) { await pausa(ms === 30 ? 30 : 30); corsa.push(conta(riposo, await foto(r))); }
    await pausa(500);
    const fine = conta(riposo, await foto(r));
    const area = r.width * r.height;
    console.log(`SOV livello nome=${nome} area=${area} diversi_in_corsa=[${corsa}] diversi_a_fine=${fine}`);
    if (!process.env.SOV_SENZA_FIX) {
      assert.notEqual(nome, 'none', 'il menu ha il suo gruppo nella transizione');
      assert.ok(Math.max(...corsa) < area * 0.15, `il menu resta visibile durante la transizione (diversi: ${corsa})`);
    }
    console.log('SOVRAPPOSTO_OK');
  } catch (e) { console.error(e); process.exitCode = 1; }
  app.quit();
});
