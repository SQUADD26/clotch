// Filo della chat (#437): trova nella sessione, testo selezionato col suo menu, giorni ed eventi, «Mostra tutto», «nuovi messaggi», suggerimento della barra.
// Renderer vero con i canali della scena; finestra mai visibile, mai attiva, audio muto.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const { creaCronologiaScena } = require('../dist/src/scena-cronologia.js');

app.whenReady().then(async () => {
  const scene = require('../design/scene/101-8036.json');
  const id = scene.elenco.sessioni[0].id;
  const MIN = 60_000, inizioOggi = new Date().setHours(0, 0, 0, 0), ieri = inizioOggi - 3 * 60 * MIN;
  const righe = ['PASS a.test.ts (1 test)', ...Array.from({ length: 20 }, (_, i) => `riga ${i}`)].join('\n');
  scene.messaggi[id] = [
    { tipo: 'utente', testo: 'Prima domanda', t: ieri },
    { tipo: 'assistente', testo: 'Il controllo è finito', modello: null, t: ieri + 1000 },
    ...Array.from({ length: 40 }, (_, i) => ({ tipo: 'assistente', testo: `Riga di riempimento ${i}`, modello: null, t: ieri + 2000 + i })),
    { tipo: 'strumento', id: 'b1', nome: 'Bash', ingresso: { command: 'git checkout -b feat/9-prova' }, esito: { testo: 'ok', errore: false }, t: inizioOggi + MIN },
    { tipo: 'utente', testo: 'Seconda domanda', t: inizioOggi + 2 * MIN },
    { tipo: 'strumento', id: 'b2', nome: 'Bash', ingresso: { command: 'npm test' }, esito: { testo: righe, errore: false }, t: inizioOggi + 2 * MIN + 1000 },
    { tipo: 'assistente', testo: 'Altro controllo, poi basta', modello: null, t: inizioOggi + 3 * MIN },
  ];
  scene.registro = { chat: {}, fermoTutto: false, avvisi: [], clotch: null, friday: null, comandi: [], decisioni: [], regole: [], nonDisturbare: null, impostazioni: null, esiti: {}, errori: [] };
  collegaScena(ipcMain, scene);
  const history = creaCronologiaScena((sid) => scene.messaggi[sid] ?? []);
  ipcMain.removeHandler('sessioni:messaggi');
  ipcMain.handle('sessioni:messaggi', (_e, sid, pagina, opzioni) => history.pagina(sid, pagina, opzioni));
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  let showEvents = 0, focusEvents = 0;
  win.on('show', () => showEvents++);
  win.on('focus', () => focusEvents++);
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  const ready = (selector) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => document.querySelector(${JSON.stringify(selector)}) ? resolve() : Date.now() > end ? reject(new Error('Elemento assente: ' + ${JSON.stringify(selector)})) : setTimeout(tick, 20);
    tick();
  })`);
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: id } });
    await ready('.filo .testo-risposta');

    // giorni ed eventi: «Ieri» in cima, «Oggi» dove cambia, «Ramo creato» al posto del comando
    const righeEvento = await run(() => [...document.querySelectorAll('.riga-evento .testo')].map((e) => e.textContent));
    assert.deepEqual(righeEvento, ['Ieri', 'Oggi', 'Ramo creato: feat/9-prova']);
    assert.equal(await run(() => [...document.querySelectorAll('.filo .strumento .dettaglio')].some((e) => /checkout/.test(e.textContent))), false);
    console.log('FILO_EVENTI_OK');

    // «Mostra tutto (21 righe)»: tre righe finché non si apre, poi tutte; «Mostra meno» le richiude
    await run(() => document.querySelector('.filo .strumento .testata:not(:disabled)').click());
    await ready('.mostra-tutto');
    assert.equal(await run(() => document.querySelector('.mostra-tutto').textContent), 'Mostra tutto (21 righe)');
    assert.equal(await run(() => document.querySelector('.blocco-codice .uscita').textContent.split('\n').length), 3);
    await run(() => document.querySelector('.mostra-tutto').click());
    assert.equal(await run(() => document.querySelector('.blocco-codice .uscita').textContent.split('\n').length), 21);
    assert.equal(await run(() => document.querySelector('.mostra-tutto').textContent), 'Mostra meno');
    console.log('FILO_MOSTRA_TUTTO_OK');

    // ⌘F apre la barra; tre «controllo» (due risposte e il pannello), il contatore dice «1 di 2»; Invio passa al secondo; Esc chiude e toglie le evidenziazioni
    await run(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', metaKey: true, bubbles: true, cancelable: true })); });
    await ready('.trova input');
    await run(() => { const i = document.querySelector('.trova input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'controllo'); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await pausa(300);
    assert.equal(await run(() => document.querySelector('.trova .contatore').textContent), '1 di 3');
    assert.equal(await run(() => CSS.highlights.get('trova').size), 3);
    await run(() => document.querySelector('.trova input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    await pausa(100);
    assert.equal(await run(() => document.querySelector('.trova .contatore').textContent), '2 di 3');
    await run(() => document.querySelector('.trova input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await pausa(100);
    assert.equal(await run(() => !document.querySelector('.trova') && !CSS.highlights.has('trova')), true);
    console.log('FILO_TROVA_OK');

    // testo scelto + clic destro: Copia, Seleziona tutto, Chiedi a clotch AI; senza testo scelto solo Seleziona tutto
    await run(() => { const t = document.querySelector('.filo .testo-risposta'); getSelection().selectAllChildren(t);
      t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 })); });
    await ready('.menu');
    assert.deepEqual(await run(() => [...document.querySelectorAll('.menu .voce .etichetta')].map((e) => e.textContent)), ['Copia', 'Seleziona tutto', 'Chiedi a clotch AI']);
    await run(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await run(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await pausa(100);
    await run(() => { getSelection().removeAllRanges(); document.querySelector('.filo').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 })); });
    await ready('.menu');
    assert.deepEqual(await run(() => [...document.querySelectorAll('.menu .voce .etichetta')].map((e) => e.textContent)), ['Seleziona tutto']);
    console.log('FILO_SELEZIONE_OK');

    // suggerimento della barra: dopo l'attesa compare «Nascondi barra laterale» con la scorciatoia
    await run(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await run(() => document.querySelector('.con-tooltip').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    await run(() => document.querySelector('.con-tooltip').dispatchEvent(new MouseEvent('mouseenter')));
    await ready('.tooltip');
    assert.equal(await run(() => document.querySelector('.tooltip').textContent), 'Nascondi barra laterale⌘\\');
    console.log('FILO_SUGGERIMENTO_OK');

    // «nuovi messaggi»: letto in alto, arriva una risposta: il punto di lettura resta, compare la pillola; un clic porta in fondo
    await run(() => { const f = document.querySelector('.filo'); f.scrollTop = 0; f.dispatchEvent(new Event('scroll')); });
    win.webContents.send('sessioni:aggiornamento', { sessioni: [], nuoviMessaggi: [], cronologia: [{ tipo: 'upsert', sessione: id, epoca: `fixture:${id}`, daSeq: 1, aSeq: 2, totale: 47,
      righe: [{ chiave: `fixture:${id}:46`, ordine: 46, revisione: 2, messaggio: { tipo: 'assistente', testo: 'Arrivata adesso', modello: null, t: null } }] }] });
    await ready('.nuovi-messaggi');
    assert.equal(await run(() => document.querySelector('.nuovi-messaggi').textContent), '1 nuovo messaggio');
    assert.equal(await run(() => document.querySelector('.filo').scrollTop), 0);
    await run(() => document.querySelector('.nuovi-messaggi').click());
    await pausa(1200);
    assert.equal(await run(() => { const f = document.querySelector('.filo'); return f.scrollHeight - f.clientHeight - f.scrollTop < 30 && !document.querySelector('.nuovi-messaggi'); }), true);
    console.log('FILO_NUOVI_MESSAGGI_OK');

    assert.equal(win.isVisible(), false);
    assert.equal(win.isFocused(), false);
    assert.equal(showEvents + focusEvents, 0);
    console.log('HIDDEN_WINDOW_OK shows=0 focus=0');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
