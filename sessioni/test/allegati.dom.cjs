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
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { esito: 'ok' }; });
  ipcMain.removeHandler('casella:scegli');
  ipcMain.handle('casella:scegli', () => [{ percorso: '/tmp/prova.png', nome: 'prova.png', tipo: 'immagine', byte: 312000 }]);
  // il Mac copia ogni file in ~/.claude/casella/allegati/<id>/<nome> (il motore accetta solo lì); un file oltre il limite resta dov'è
  const COPIE = '/Users/privato/.claude/casella/allegati';
  const incollate = [];
  ipcMain.removeHandler('casella:copia');
  ipcMain.handle('casella:copia', (_e, percorsi) => percorsi.map((p) => p === '/tmp/prova.mov'
    ? { percorso: p, nome: 'prova.mov', tipo: 'file', byte: 480000000 }
    : { percorso: `${COPIE}/uuid-1/${p.split('/').pop()}`, nome: p.split('/').pop(), tipo: p.endsWith('.png') ? 'immagine' : 'file', byte: 312000 }));
  ipcMain.removeHandler('casella:incolla');
  ipcMain.handle('casella:incolla', (_e, mime, byte) => { incollate.push({ mime, byte: byte.length }); return { percorso: `${COPIE}/uuid-2/immagine.png`, nome: 'immagine.png', tipo: 'immagine', byte: byte.length }; });
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

    // menu Aggiungi -> «Allega file…» -> miniatura nella casella -> invio coi percorsi della copia nel campo `allegati`, testo senza `@`
    const scrivi = (testo) => run(() => {}).then(() => win.webContents.executeJavaScript(`(() => {
      const t = document.querySelector('.casella textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(testo)});
      t.dispatchEvent(new Event('input', { bubbles: true }));
    })()`));
    const aspetta = (ms = 150) => new Promise((r) => setTimeout(r, ms));
    await run(() => document.querySelector('button[aria-label="Aggiungi"]').click());
    await ready('.aggiungi .menu');
    assert.deepEqual(await run(() => [...document.querySelectorAll('.aggiungi .menu .voce .etichetta')].map((e) => e.textContent)).then((x) => x.slice(0, 3)),
      ['Allega file…', 'Imposta obiettivo', 'Modalità piano']);
    await run(() => document.querySelector('.aggiungi .menu .voce').click());
    await ready('.allegati-casella .allegato');
    assert.equal(await run(() => document.querySelector('.allegati-casella .allegato').title), 'prova.png');
    await scrivi('Controlla questa');
    await aspetta();
    await run(() => document.querySelector('.bottone-invia').click());
    await aspetta(250);
    let manda = comandi.filter((c) => c.cmd === 'manda').at(-1);
    assert.equal(manda.args.testo, 'Controlla questa');
    assert.deepEqual(manda.args.allegati, [`${COPIE}/uuid-1/prova.png`]);
    assert.equal(await run(() => !!document.querySelector('.allegati-casella')), false, 'dopo l\'invio le miniature spariscono');

    // solo un'immagine incollata, senza testo: salvata dal Mac e mandata col suo percorso
    await run(() => {
      const d = new DataTransfer();
      d.items.add(new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }));
      document.querySelector('.casella textarea').dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true }));
    });
    await ready('.allegati-casella .allegato');
    assert.deepEqual(incollate, [{ mime: 'image/png', byte: 3 }]);
    assert.equal(await run(() => document.querySelector('.bottone-invia').disabled), false, 'con una immagine il messaggio può partire senza testo');
    const prima = comandi.filter((c) => c.cmd === 'manda').length;
    await run(() => document.querySelector('.bottone-invia').click());
    await aspetta(250);
    manda = comandi.filter((c) => c.cmd === 'manda').at(-1);
    assert.equal(comandi.filter((c) => c.cmd === 'manda').length, prima + 1);
    assert.equal(manda.args.testo, '');
    assert.deepEqual(manda.args.allegati, [`${COPIE}/uuid-2/immagine.png`]);

    // file oltre il limite del suo tipo: l'avviso dice il perché, il messaggio non parte finché non lo togli
    ipcMain.removeHandler('casella:scegli');
    ipcMain.handle('casella:scegli', () => [{ percorso: '/tmp/prova.mov', nome: 'prova.mov', tipo: 'file', byte: 480000000 }]);
    await run(() => document.querySelector('button[aria-label="Aggiungi"]').click());
    await ready('.aggiungi .menu');
    await run(() => document.querySelector('.aggiungi .menu .voce').click());
    await ready('.avviso-allegato');
    assert.equal(await run(() => document.querySelector('.avviso-allegato').textContent),
      'File troppo grandeprova.mov non parte: pesa 480 MB e il limite è 200 KB. Rimuovilo o allega un file più piccolo.Rimuovi file');
    await scrivi('Guarda');
    await aspetta();
    const inviati = comandi.filter((c) => c.cmd === 'manda').length;
    assert.equal(await run(() => document.querySelector('.bottone-invia').disabled), true);
    await run(() => document.querySelector('.bottone-invia').click());
    await aspetta();
    assert.equal(comandi.filter((c) => c.cmd === 'manda').length, inviati, 'un file troppo grande non parte');
    await run(() => [...document.querySelectorAll('.avviso-allegato button')].find((b) => b.textContent === 'Rimuovi file').click());
    await aspetta();
    assert.equal(await run(() => !!document.querySelector('.avviso-allegato') || !!document.querySelector('.allegati-casella .allegato')), false);
    assert.equal(await run(() => document.querySelector('.bottone-invia').disabled), false);
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
