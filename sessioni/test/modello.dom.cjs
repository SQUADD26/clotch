// Menu «Modello e impegno» (#653 #654 #661): nomi lunghi dentro il menu, a 480 niente taglio, tastiera tra le due colonne, spunta con suffisso di data.
// Lancio: npm run build && CLOTCH_TEST_SILENT=1 npx electron test/modello.dom.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  const scene = structuredClone(require('../design/scene/101-14849.json'));
  scene.elenco.sessioni[0].modello = 'claude-sonnet-4-6-20260101'; // fuori dai principali, con la data
  scene.registro.chat.s1.coda = [];
  const lungo = 'claude-modello-sperimentale-con-nome-molto-lungo-1';
  scene.modelli = [
    { modello: 'claude-opus-5-5', sforzi: ['low', 'high', 'max'], rapida: true }, { modello: 'claude-fable-5-1', sforzi: ['medium'] },
    { modello: 'claude-sonnet-5-5' }, { modello: 'claude-haiku-5-5', sforzi: [] }, { modello: 'claude-sonnet-4-6', sforzi: ['low', 'high'] },
    ...Array.from({ length: 12 }, (_, i) => ({ modello: `${lungo}-${i}`, sforzi: ['low'] })),
  ];
  collegaScena(ipcMain, scene);
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 900, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  const run = (fn, ...a) => win.webContents.executeJavaScript(`(${fn})(...${JSON.stringify(a)})`);
  const attendi = (fn) => win.webContents.executeJavaScript(`new Promise((ok, no) => { const f = Date.now() + 5000; const t = () => (${fn})() ? ok() : Date.now() > f ? no(new Error('scaduto')) : setTimeout(t, 20); t(); })`);
  const tasto = (key) => run((key) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })), key);
  const pausa = (ms = 150) => new Promise((ok) => setTimeout(ok, ms));
  const fuoco = () => run(() => document.activeElement?.textContent?.trim().slice(0, 30));
  try {
    for (const [w, h] of [[1440, 900], [480, 700]]) {
      win.setContentSize(w, h);
      await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: 's1' } });
      await attendi(() => !!document.querySelector('.chip-menu button.chip[aria-label="Modello e impegno"]'));
      await run(() => document.querySelector('.chip-menu button.chip[aria-label="Modello e impegno"]').click());
      await attendi(() => document.querySelectorAll('.menu-casella .voce').length > 3);
      // #661: il modello in uso (con la data) ha la spunta dopo aver aperto «Altri modelli»
      await run(() => [...document.querySelectorAll('.menu-casella .voce')].find((b) => b.textContent.includes('Altri modelli')).click());
      await pausa();
      const r = await run(() => {
        const m = document.querySelector('.menu-casella.flottante'), dentro = (e) => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; };
        const voci = [...m.querySelectorAll('.voce')];
        return { spuntati: [...m.querySelectorAll('[aria-checked="true"]')].map((b) => b.textContent.trim()), chip: document.querySelector('.chip-menu button.chip[aria-label="Modello e impegno"]').textContent.trim(),
          menuDentro: dentro(m), altezza: Math.round(m.getBoundingClientRect().height), voceFuori: voci.filter((v) => v.scrollWidth > v.clientWidth + 1 && !getComputedStyle(v.querySelector('.etichetta')).textOverflow.includes('ellipsis')).length,
          sporgono: voci.filter((v) => v.getBoundingClientRect().right > m.getBoundingClientRect().right + 1).length };
      });
      console.log('MENU', w, JSON.stringify(r));
      assert.ok(r.menuDentro && r.sporgono === 0 && r.voceFuori === 0, `menu dentro la finestra a ${w}`);
      assert.deepEqual(r.spuntati, ['Sonnet 4.6'], 'il modello con la data ha la spunta');
      // #654: ArrowRight sul primo modello entra in «Impegno», ArrowLeft torna, Tab chiude
      await run(() => document.querySelector('.menu-casella [aria-label="Modello"] .voce').focus());
      await tasto('ArrowRight'); await pausa(300);
      const dopoDestra = await run(() => ({ in: !!document.activeElement?.closest('.menu-casella.impegno'), fuoco: document.activeElement?.textContent?.trim(),
        dentro: (() => { const b = document.querySelector('.menu-casella.impegno')?.getBoundingClientRect(); return !!b && b.left >= 0 && b.right <= innerWidth; })() }));
      console.log('DESTRA', w, JSON.stringify(dopoDestra));
      assert.ok(dopoDestra.in && dopoDestra.dentro, 'ArrowRight entra in Impegno, dentro la finestra');
      await tasto('ArrowLeft'); await pausa();
      assert.ok((await fuoco()).startsWith('Opus 5.5'), 'ArrowLeft torna al modello di partenza');
      await tasto('Tab'); await pausa(300);
      assert.equal(await run(() => document.querySelectorAll('.menu-casella').length), 0, 'Tab chiude il menu');
    }
    console.log('MODELLO OK');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { app.quit(); }
});
