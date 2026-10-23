// Allegati, immagini e visore (#437) nel renderer vero, con i dati di una scena: nessun file, finestra o comando reale del Mac.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  const scena = JSON.parse(JSON.stringify(require('../design/scene/101-28041.json')));
  collegaScena(ipcMain, scena);
  const comandi = [];
  ipcMain.removeHandler('friday:comando');
  ipcMain.handle('friday:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { esito: 'ok' }; });
  ipcMain.removeHandler('casella:scegli');
  ipcMain.handle('casella:scegli', () => [{ percorso: '/tmp/prova.png', nome: 'prova.png', tipo: 'immagine', byte: 312000 }]);
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  let mostrate = 0, focalizzate = 0;
  win.on('show', () => mostrate++);
  win.on('focus', () => focalizzate++);
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  const ready = (selector) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => document.querySelector(${JSON.stringify(selector)}) ? resolve() : Date.now() > end ? reject(new Error('Elemento assente: ' + ${JSON.stringify(selector)})) : setTimeout(tick, 20);
    tick();
  })`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: scena.elenco.sessioni[0].id } });
    await ready('.allegati-messaggio .chip-allegato');
    // chip del messaggio: nome e peso veri dalle righe `@percorso`, il testo senza le righe
    await ready('.miniatura img');
    assert.deepEqual(await run(() => [...document.querySelectorAll('.allegati-messaggio .chip-allegato')].map((c) => c.textContent)), ['schermata-notch.png312 KB', 'lettore.ts4 KB']);
    assert.equal(await run(() => document.querySelector('.messaggio-roberto .bolla').textContent), 'Guarda la schermata: il notch copre il titolo della sessione.');
    console.log('ALLEGATI_FILO_OK');

    // visore: dalla miniatura, «1 di 2», frecce, Esc
    await run(() => document.querySelector('.miniatura').click());
    await ready('.visore');
    assert.equal(await run(() => document.querySelector('.visore .nome').textContent), 'notch-sopra-il-titolo.png · 1 di 2');
    await run(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await run(() => document.querySelector('.visore .nome').textContent), 'schermata-notch.png · 2 di 2');
    await ready('.visore img');
    await run(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await run(() => !!document.querySelector('.visore')), false);
    console.log('VISORE_OK');

    // zona di rilascio: compare solo con file trascinati
    await run(() => { const d = new DataTransfer(); d.items.add(new File(['x'], 'a.txt')); dispatchEvent(new DragEvent('dragenter', { dataTransfer: d })); });
    await ready('.zona-rilascio');
    assert.equal(await run(() => document.querySelector('.zona-rilascio').textContent), 'Rilascia per allegare');
    await run(() => { const d = new DataTransfer(); d.items.add(new File(['x'], 'a.txt')); dispatchEvent(new DragEvent('dragleave', { dataTransfer: d })); });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await run(() => !!document.querySelector('.zona-rilascio')), false);
    console.log('RILASCIO_OK');

    // menu Aggiungi -> «Allega file o cartelle…» -> chip nella casella -> invio coi percorsi in fondo al testo
    await run(() => document.querySelector('button[aria-label="Aggiungi"]').click());
    await ready('.aggiungi .menu');
    assert.deepEqual(await run(() => [...document.querySelectorAll('.aggiungi .menu .voce .etichetta')].map((e) => e.textContent)).then((x) => x.slice(0, 3)),
      ['Allega file o cartelle…', 'Imposta obiettivo', 'Modalità piano']);
    await run(() => document.querySelector('.aggiungi .menu .voce').click());
    await ready('.allegati-casella .chip-allegato');
    assert.equal(await run(() => document.querySelector('.allegati-casella .chip-allegato').textContent), 'prova.png312 KB');
    await run(() => {
      const t = document.querySelector('.casella textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'Controlla questa');
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 100));
    await run(() => document.querySelector('.bottone-invia').click());
    await new Promise((r) => setTimeout(r, 200));
    const manda = comandi.find((c) => c.cmd === 'manda');
    assert.equal(manda.args.testo, 'Controlla questa\n@/tmp/prova.png');
    assert.equal(await run(() => !!document.querySelector('.allegati-casella')), false, 'dopo l\'invio i chip spariscono');
    console.log('CASELLA_ALLEGATI_OK');

    assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false);
    assert.equal(mostrate, 0); assert.equal(focalizzate, 0);
    console.log('HIDDEN_WINDOW_OK shows=0 focus=0');
    console.log('ALLEGATI_DOM_OK');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
