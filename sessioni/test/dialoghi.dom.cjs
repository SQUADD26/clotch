// Dialoghi «aggiornamento» (101:22137) e «scorciatoie da tastiera» (101:22186) nel renderer vero (#437): finestra nascosta, IPC simulato.
// «Aggiorna» non riapre niente: il finto main registra solo cosa gli è stato chiesto.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_e, c) => c.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
app.on('window-all-closed', () => {});
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));

const scene = JSON.parse(JSON.stringify(require('../design/scene/101-8036.json')));
scene.navigazione = { vista: 'sessione', sessione: scene.elenco.sessioni[0].id };
const sessioni = ['a', 'b', 'c'].map((id) => ({ ...scene.elenco.sessioni[0], id, titolo: `Sessione ${id}` }));
scene.elenco.sessioni = sessioni;
scene.messaggi = { a: [], b: [], c: [] };
const finto = { nuova: false, chiamate: [], errore: null };
let win, mostrate = 0, fuochi = 0;
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
const run = async (fn, ...a) => {
  const r = await win.webContents.executeJavaScript(`(async () => { try { return { v: await (${fn})(...${JSON.stringify(a)}) }; } catch (e) { return { e: String(e && e.message || e) }; } })()`);
  if (r.e) throw new Error(r.e);
  return r.v;
};
const wait = (fn, ...a) => win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 4000; const f = ${fn};
  const t = () => { let v = false; try { v = f(...${JSON.stringify(a)}); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 110))})) : setTimeout(t, 15); }; t(); })`);
const tasto = (init) => run((i) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...i })) , init);
const dialogo = () => run(() => document.querySelector('[role=dialog]')?.getAttribute('aria-label') ?? null);
const clicca = (sel, testo) => run((sel, testo) => { const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').trim() === testo); if (!el) throw new Error('manca ' + sel + ' ' + testo); el.click(); }, sel, testo);
const scelta = () => run(() => document.querySelector('.riga-sessione.scelta .testo')?.textContent);
const carica = async () => { await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: 'a' } }); await wait(() => document.querySelectorAll('.riga-sessione').length >= 3); };
const risultati = [];
async function check(nome, fn) {
  let errore = null;
  try { await fn(); } catch (e) { errore = e; }
  risultati.push(!errore);
  console.log(`${errore ? 'FAIL' : 'OK'} ${nome}${errore ? ': ' + String(errore.message).split('\n')[0].slice(0, 220) : ''}`);
}

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  for (const c of ['impostazioni:aggiornamenti', 'impostazioni:versione', 'sessioni:elenco']) ipcMain.removeHandler(c);
  ipcMain.handle('impostazioni:versione', () => '0.1.0');
  ipcMain.handle('sessioni:elenco', () => scene.elenco);
  ipcMain.handle('impostazioni:aggiornamenti', (_e, fai) => { finto.chiamate.push(fai); if (finto.errore) throw new Error(finto.errore); return fai === 'installa' ? false : finto.nuova; });
  win = new BrowserWindow({ show: false, focusable: false, width: 1600, height: 1000, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  win.on('show', () => mostrate++); win.on('focus', () => fuochi++);
  await carica();

  await check('SCORCIATOIE: ⌘/ apre e chiude, Esc chiude, la ricerca filtra', async () => {
    assert.equal(await dialogo(), null);
    await tasto({ key: '/', code: 'Slash', metaKey: true });
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Scorciatoie da tastiera');
    assert.equal(await run(() => document.querySelectorAll('.riga-tasto').length), 20);
    await run(() => { const i = document.querySelector('[role=dialog] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'coda'); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(() => document.querySelectorAll('.riga-tasto').length === 1);
    assert.equal(await run(() => document.querySelector('.riga-tasto').textContent), 'Metti in coda⌘↵');
    await run(() => { const i = document.querySelector('[role=dialog] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'kubernetes'); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(() => document.body.innerText.includes('Nessun risultato'));
    await tasto({ key: 'Escape' });
    await wait(() => !document.querySelector('[role=dialog]'));
    await tasto({ key: '/', code: 'Slash', metaKey: true });
    await wait(() => !!document.querySelector('[role=dialog]'));
    await run(() => document.querySelector('[role=dialog] .chiudi').click());
    await wait(() => !document.querySelector('[role=dialog]'));
  });

  await check('SCORCIATOIE: dal menu del profilo, con i tasti salvati dalle impostazioni', async () => {
    await run(() => document.querySelector('.piede .avatar').click());
    await wait(() => [...document.querySelectorAll('[role=menu] .voce')].some((e) => e.textContent.includes('Scorciatoie da tastiera')));
    await clicca('[role=menu] .voce', 'Scorciatoie da tastiera⌘/');
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await run(() => [...document.querySelectorAll('.riga-tasto')].find((r) => r.textContent.startsWith('Ferma la sessione')).textContent), 'Ferma la sessione⌘.');
    await tasto({ key: 'Escape' });
  });

  await check('SESSIONE PRIMA E DOPO: ⌃↓ e ⌃↑', async () => {
    assert.equal(await scelta(), 'Sessione a');
    await tasto({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true });
    await wait(() => document.querySelector('.riga-sessione.scelta .testo')?.textContent === 'Sessione b');
    await tasto({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true });
    await tasto({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true });
    await wait(() => document.querySelector('.riga-sessione.scelta .testo')?.textContent === 'Sessione c');
  });

  await check('AGGIORNAMENTO: nessuna versione nuova = avviso con la versione vera, nessun dialogo', async () => {
    finto.nuova = false; finto.chiamate.length = 0;
    await run(() => document.querySelector('.piede .avatar').click());
    await clicca('[role=menu] .voce', 'Verifica aggiornamenti…');
    await wait(() => document.body.innerText.includes('Già aggiornato · versione 0.1.0'));
    assert.equal(await dialogo(), null);
    assert.deepEqual(finto.chiamate, [true]);
  });

  await check('AGGIORNAMENTO: versione nuova = dialogo; «Più tardi» chiude senza riaprire', async () => {
    finto.nuova = true; finto.chiamate.length = 0;
    await run(() => document.querySelector('.piede .avatar').click());
    await clicca('[role=menu] .voce', 'Verifica aggiornamenti…');
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Aggiornare clotch ora?');
    await clicca('[role=dialog] button', 'Più tardi');
    await wait(() => !document.querySelector('[role=dialog]'));
    assert.deepEqual(finto.chiamate, [true]);
  });

  await check('AGGIORNAMENTO: «Aggiorna» chiede al main di riaprire; se non riapre, lo dice', async () => {
    finto.nuova = true; finto.chiamate.length = 0;
    await run(() => document.querySelector('.piede .avatar').click());
    await clicca('[role=menu] .voce', 'Verifica aggiornamenti…');
    await wait(() => !!document.querySelector('[role=dialog]'));
    await clicca('[role=dialog] button', 'Aggiorna');
    await wait(() => document.body.innerText.includes('Riavvio non riuscito'));
    assert.deepEqual(finto.chiamate, [true, 'installa']);
    await wait(() => !document.querySelector('[role=dialog]'));
  });

  await check('AGGIORNAMENTO: errore del main = avviso, nessun dialogo', async () => {
    finto.errore = 'Controllo non riuscito. Riprova.';
    await run(() => document.querySelector('.piede .avatar').click());
    await clicca('[role=menu] .voce', 'Verifica aggiornamenti…');
    await wait(() => document.body.innerText.includes('Controllo non riuscito'));
    assert.equal(await dialogo(), null);
    finto.errore = null;
  });

  await check('INFO: «Controlla aggiornamenti» usa lo stesso controllo del menu (avviso o dialogo)', async () => {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'impostazioni', sezione: 'info' } });
    const voce = async () => { await wait(() => !!document.querySelector('button[aria-label^="Versione"]')); await run(() => document.querySelector('button[aria-label^="Versione"]').click()); await clicca('[role=menu] .voce', 'Controlla aggiornamenti'); };
    finto.nuova = false; finto.chiamate.length = 0;
    await voce();
    await wait(() => document.body.innerText.includes('Già aggiornato · versione 0.1.0'));
    assert.deepEqual(finto.chiamate, [true]);
    finto.nuova = true;
    await voce();
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Aggiornare clotch ora?');
  });

  assert.equal(mostrate, 0, 'nessun evento show'); assert.equal(fuochi, 0, 'nessun evento focus');
  assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false); assert.equal(win.webContents.isAudioMuted(), true);
  console.log(`HIDDEN_WINDOW_OK shows=${mostrate} focus=${fuochi}`);
  console.log(`DIALOGHI_RIEPILOGO ok=${risultati.filter(Boolean).length} fail=${risultati.filter((x) => !x).length}`);
  app.exit(risultati.every(Boolean) ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
