// Finestre strette e barra ridimensionabile (101:29280, 29399, 29552, 29770, 29971): scena di prova, finestra invisibile e muta.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const scene = require(path.join(root, 'design/scene/101-8036.json'));

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  const win = new BrowserWindow({ show: false, focusable: false, width: 1800, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  let mostrate = 0, focalizzate = 0;
  win.on('show', () => mostrate++);
  win.on('focus', () => focalizzate++);
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  const wait = (check) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 2000;
    const test = ${check};
    const tick = () => test() ? resolve() : Date.now() > end ? reject(new Error('Condizione UI non raggiunta: ' + test)) : setTimeout(tick, 20);
    tick();
  })`);
  const click = (sel) => run(`() => document.querySelector('${sel}').click()`);
  const tasto = (sel, key) => run(`() => document.querySelector('${sel}').dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true }))`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: scene.navigazione });
    await wait(() => !!document.querySelector('.barra-laterale') && !!document.querySelector('.maniglia-barra') && !!document.querySelector('.pannello'));
    const larga = () => run(() => document.querySelector('.barra-laterale').getBoundingClientRect().width);
    assert.equal(await larga(), 266, 'barra come nel disegno');
    await tasto('.maniglia-barra', 'ArrowRight');
    await wait(() => document.querySelector('.barra-laterale').getBoundingClientRect().width === 282);
    await run(() => document.querySelector('.maniglia-barra').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    await wait(() => document.querySelector('.barra-laterale').getBoundingClientRect().width === 266);
    for (let i = 0; i < 20; i++) await tasto('.maniglia-barra', 'ArrowRight');
    await wait(() => document.querySelector('.barra-laterale').getBoundingClientRect().width === 426); // massimo: 266 + metà del pannello
    await run(() => document.querySelector('.maniglia-barra').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const punta = (tipo, x) => run(`() => document.querySelector('.maniglia-barra').dispatchEvent(new PointerEvent('${tipo}', { clientX: ${x}, pointerId: 7, bubbles: true }))`);
    await punta('pointerdown', 266); await punta('pointermove', 340);
    await wait(() => document.querySelector('.barra-laterale').getBoundingClientRect().width === 340);
    await punta('pointermove', 100); // sotto il minimo del disegno non si va
    await wait(() => document.querySelector('.barra-laterale').getBoundingClientRect().width === 266);
    await punta('pointerup', 300);
    await wait(() => document.querySelector('.barra-laterale').getBoundingClientRect().width === 300 && !document.querySelector('.maniglia-barra.attiva'));
    await run(() => document.querySelector('.maniglia-barra').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    await wait(() => document.querySelector('.barra-laterale').getBoundingClientRect().width === 266);
    console.log('LAYOUT_MANIGLIA_OK');

    win.setSize(768, 1000); // 101:29552: barra chiusa, il pannello non ha posto, la barra si apre sopra
    await wait(() => !document.querySelector('.barra-laterale') && !document.querySelector('.pannello') && !document.querySelector('.maniglia-barra'));
    await click('button[aria-label="Barra laterale"]');
    await wait(() => !!document.querySelector('.velo-barra') && !!document.querySelector('.barra-laterale.sopra'));
    assert.equal(await run(() => document.querySelector('.barra-laterale.sopra').getBoundingClientRect().width), 266);
    await run(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await wait(() => !document.querySelector('.barra-laterale'));
    await click('button[aria-label="Barra laterale"]');
    await wait(() => !!document.querySelector('.velo-barra'));
    await click('.velo-barra');
    await wait(() => !document.querySelector('.velo-barra') && !document.querySelector('.barra-laterale'));
    console.log('LAYOUT_BARRA_SOPRA_OK');

    await click('button[aria-label="Mostra pannello"]'); // il bottone non resta muto: il pannello si apre sopra la colonna
    await wait(() => !!document.querySelector('.pannello.sopra'));
    await click('button[aria-label="Mostra pannello"]'); // il bottone gira (#437): obiettivo -> Info sessione -> chiuso
    await click('button[aria-label="Mostra pannello"]');
    await wait(() => !document.querySelector('.pannello'));
    console.log('LAYOUT_PANNELLO_SOPRA_OK');

    win.setSize(600, 1000); // 101:29770: sotto la bolla piena la casella è compatta
    await wait(() => !!document.querySelector('.corpo[data-compatta]'));
    const mostrati = () => run(() => Object.fromEntries(['.chip .etichetta', '.chip .livello', '.contesto'].map((s) => { const e = document.querySelector('.casella ' + s); return [s, e ? getComputedStyle(e).display !== 'none' : null]; })));
    const stretti = await mostrati();
    assert.equal(stretti['.chip .etichetta'], false, '«Chiedi approvazione» nascosto nella casella compatta');
    assert.equal(stretti['.chip .livello'], false, '«Medio» nascosto nella casella compatta');
    assert.notEqual(stretti['.contesto'], true, 'il contesto non si vede nella casella compatta');
    // 101:29770 e 101:29971: il testo dei dati si taglia dove finisce il suo posto, mai sotto i bottoni
    const dati = () => run(() => { const d = document.querySelector('.intestazione .dati'), a = document.querySelector('.intestazione .azioni');
      return { fine: d.getBoundingClientRect().right, bottoni: a.getBoundingClientRect().left, tagliato: d.scrollWidth > d.clientWidth, sotto: [...d.children].every((c) => c.getBoundingClientRect().left < d.getBoundingClientRect().right) }; });
    for (const larghezza of [600, 480]) {
      win.setSize(larghezza, 1000);
      await wait(`() => Math.abs(window.innerWidth - ${larghezza}) < 2 && !!document.querySelector('.intestazione .dati')`);
      const m = await dati();
      assert.ok(m.fine <= m.bottoni, `${larghezza}: i dati finiscono prima dei bottoni (${m.fine} > ${m.bottoni})`);
      assert.ok(m.tagliato, `${larghezza}: il testo dei dati è più lungo del suo posto e si taglia`);
    }
    win.setSize(600, 1000);
    win.setSize(768, 1000);
    await wait(() => !document.querySelector('.corpo[data-compatta]'));
    const larghi = await mostrati();
    assert.equal(larghi['.chip .etichetta'], true, 'larga: il testo dei chip c\'è');
    assert.equal(larghi['.chip .livello'], true, 'larga: lo sforzo c\'è');
    win.setSize(1800, 1000); // tornati larghi: ognuno ha il suo stato, la barra è dov'era e il pannello pure
    await wait(() => !!document.querySelector('.barra-laterale') && !!document.querySelector('.pannello') && !document.querySelector('.pannello.sopra'));
    console.log('LAYOUT_COMPATTA_E_RITORNO_OK');
    assert.equal(win.isVisible(), false);
    assert.equal(win.isFocused(), false);
    assert.equal(mostrate + focalizzate, 0);
    console.log('LAYOUT_FINESTRE_OK shows=0 focus=0');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
