// Azioni e dialoghi del disegno (#460) nel renderer vero: Rinomina… e «Rinomina sessione», Rinomina etichetta… e Nascondi cartella nel menu della cartella,
// Novità nel menu del profilo, «Rimuovere la cartella?» in Impostazioni · Account, chip «Carico…» e «Troppo grande» nella casella.
// Finestra nascosta e muta, IPC simulato: il finto main salva e rimanda le preferenze come il vero.
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
const CARTELLA = '/tmp/lavori/clotch';
scene.navigazione = { vista: 'sessione', sessione: 'a' };
scene.elenco.sessioni = ['a', 'b', 'c'].map((id) => ({ ...scene.elenco.sessioni[0], id, titolo: `Sessione ${id}`, cartella: CARTELLA }));
scene.messaggi = { a: [], b: [], c: [] };
scene.cartelle = [{ percorso: '~/.claude-uno', dettaglio: '3 sessioni · letta ora', errore: false }, { percorso: '~/.claude-due', dettaglio: '1 sessione · letta ora', errore: false }];
const finto = { pref: {}, impostazioni: {}, chiamatePref: [], chiamateImp: [], novita: null };
let win, mostrate = 0, fuochi = 0;
const run = async (fn, ...a) => {
  const r = await win.webContents.executeJavaScript(`(async () => { try { return { v: await (${fn})(...${JSON.stringify(a)}) }; } catch (e) { return { e: String(e && e.message || e) }; } })()`);
  if (r.e) throw new Error(r.e);
  return r.v;
};
const wait = (fn, ...a) => win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 4000; const f = ${fn};
  const t = () => { let v = false; try { v = f(...${JSON.stringify(a)}); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 110))})) : setTimeout(t, 15); }; t(); })`);
const attendi = async (f) => { for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 20)); assert.ok(f(), 'Attesa scaduta: ' + String(f)); };
const dialogo = () => run(() => document.querySelector('[role=dialog]')?.getAttribute('aria-label') ?? null);
const clicca = (sel, testo) => run((sel, testo) => { const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').trim() === testo); if (!el) throw new Error('manca ' + sel + ' ' + testo); el.click(); }, sel, testo);
const menuDi = (sel, testo) => run((sel, testo) => {
  const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').includes(testo));
  if (!el) throw new Error('manca ' + sel + ' ' + testo);
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 320, clientY: 240 }));
}, sel, testo);
const voci = () => run(() => [...document.querySelectorAll('[role=menu] .voce')].map((e) => e.textContent));
const scrivi = (valore) => run((v) => { const i = document.querySelector('[role=dialog] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); }, valore);
const carica = async (query) => { await win.loadFile(path.join(root, 'renderer/index.html'), { query }); await wait(() => document.querySelectorAll('.riga-sessione').length >= 3 || !!document.querySelector('.impostazioni')); };
const risultati = [];
async function check(nome, fn) {
  let errore = null;
  try { await fn(); } catch (e) { errore = e; }
  risultati.push(!errore);
  console.log(`${errore ? 'FAIL' : 'OK'} ${nome}${errore ? ': ' + String(errore.message).split('\n')[0].slice(0, 220) : ''}`);
}

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  for (const c of ['sessioni:preferenze', 'sessioni:imposta-preferenze', 'sessioni:impostazioni', 'sessioni:imposta-impostazioni', 'impostazioni:novita', 'impostazioni:versione']) ipcMain.removeHandler(c);
  ipcMain.handle('impostazioni:versione', () => '0.1.0');
  ipcMain.handle('impostazioni:novita', () => finto.novita);
  ipcMain.handle('sessioni:preferenze', () => finto.pref);
  ipcMain.handle('sessioni:imposta-preferenze', (e, id, parte) => {
    finto.chiamatePref.push([id, parte]);
    const nuova = { ...finto.pref[id], ...parte };
    for (const k of Object.keys(nuova)) if (nuova[k] == null) delete nuova[k];
    if (Object.keys(nuova).length) finto.pref[id] = nuova; else delete finto.pref[id];
    e.sender.send('sessioni:preferenze', finto.pref);
  });
  ipcMain.handle('sessioni:impostazioni', () => finto.impostazioni);
  ipcMain.handle('sessioni:imposta-impostazioni', (e, parte) => {
    finto.chiamateImp.push(parte);
    finto.impostazioni = { ...finto.impostazioni, ...parte };
    e.sender.send('sessioni:impostazioni', finto.impostazioni);
  });
  win = new BrowserWindow({ show: false, focusable: false, width: 1600, height: 1000, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  win.on('show', () => mostrate++); win.on('focus', () => fuochi++);
  await carica({ vista: 'sessione', sessione: 'a' });

  await check('RINOMINA: la voce sta sopra «Archivia»; il dialogo parte dal nome e Salva lo scrive nelle preferenze', async () => {
    await menuDi('.riga-sessione', 'Sessione b');
    await wait(() => !!document.querySelector('[role=menu]'));
    const v = await voci();
    assert.ok(v.indexOf('Rinomina…') >= 0 && v.indexOf('Rinomina…') < v.findIndex((x) => x.startsWith('Archivia')), v.join('|'));
    await clicca('[role=menu] .voce', 'Rinomina…');
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Rinomina sessione');
    assert.equal(await run(() => document.querySelector('[role=dialog] input').value), 'Sessione b');
    assert.ok((await run(() => document.querySelector('[role=dialog]').textContent)).includes('Il nome cambia solo in clotch.'));
    await scrivi('  Lavoro nuovo ');
    await clicca('[role=dialog] button', 'Salva');
    await wait(() => !document.querySelector('[role=dialog]'));
    assert.deepEqual(finto.chiamatePref.at(-1), ['b', { nome: 'Lavoro nuovo' }]);
    await wait(() => [...document.querySelectorAll('.riga-sessione .testo')].some((e) => e.textContent === 'Lavoro nuovo'));
    assert.ok(!(await run(() => [...document.querySelectorAll('.riga-sessione .testo')].some((e) => e.textContent === 'Sessione b'))));
  });

  await check('RINOMINA: Annulla non cambia niente; un nome vuoto toglie il nome e torna il titolo', async () => {
    const prima = finto.chiamatePref.length;
    await menuDi('.riga-sessione', 'Lavoro nuovo');
    await clicca('[role=menu] .voce', 'Rinomina…');
    await wait(() => !!document.querySelector('[role=dialog]'));
    await scrivi('Altro');
    await clicca('[role=dialog] button', 'Annulla');
    await wait(() => !document.querySelector('[role=dialog]'));
    assert.equal(finto.chiamatePref.length, prima);
    await menuDi('.riga-sessione', 'Lavoro nuovo');
    await clicca('[role=menu] .voce', 'Rinomina…');
    await wait(() => !!document.querySelector('[role=dialog]'));
    await scrivi('   ');
    await clicca('[role=dialog] button', 'Salva');
    assert.deepEqual(finto.chiamatePref.at(-1), ['b', { nome: null }]);
    await wait(() => [...document.querySelectorAll('.riga-sessione .testo')].some((e) => e.textContent === 'Sessione b'));
  });

  await check('CARTELLA: «Rinomina etichetta…» salva l’etichetta nelle impostazioni e la barra la mostra', async () => {
    await menuDi('button[aria-expanded]', 'clotch');
    await wait(() => !!document.querySelector('[role=menu]'));
    const v = await voci();
    assert.deepEqual(v.map((x) => x.replace(/⇧⌘A/, '')), ['Mostra nel Finder', 'Copia percorso', 'Rinomina etichetta…', 'Archivia tutte le sessioni', 'Nascondi cartella']);
    await clicca('[role=menu] .voce', 'Rinomina etichetta…');
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Rinomina etichetta');
    assert.equal(await run(() => document.querySelector('[role=dialog] input').value), 'clotch');
    await scrivi('Notch');
    await clicca('[role=dialog] button', 'Salva');
    assert.deepEqual(finto.chiamateImp.at(-1), { etichetteCartelle: { clotch: 'Notch' } });
    await wait(() => [...document.querySelectorAll('button[aria-expanded] .testo')].some((e) => e.textContent === 'Notch'));
  });

  await check('CARTELLA: «Nascondi cartella» mette i suoi percorsi tra le cartelle escluse; «Annulla» li toglie', async () => {
    await menuDi('button[aria-expanded]', 'Notch');
    await clicca('[role=menu] .voce', 'Nascondi cartella');
    await wait(() => document.body.innerText.includes('Cartella nascosta'));
    assert.deepEqual(finto.chiamateImp.at(-1), { cartelleEscluse: [CARTELLA] });
    await clicca('button', 'Annulla');
    await attendi(() => finto.chiamateImp.at(-1).cartelleEscluse?.length === 0);
  });

  await check('PROFILO: «Novità» apre le note della versione; senza note lo dice', async () => {
    await run(() => document.querySelector('.piede .avatar').click());
    await wait(() => [...document.querySelectorAll('[role=menu] .voce')].some((e) => e.textContent === 'Novità'));
    await clicca('[role=menu] .voce', 'Novità');
    await wait(() => document.body.innerText.includes('Nessuna novità per la versione 0.1.0'));
    assert.equal(await dialogo(), null);
    finto.novita = { data: '23 ottobre 2026', voci: ['Prima voce', 'Seconda voce'] };
    await run(() => document.querySelector('.piede .avatar').click());
    await clicca('[role=menu] .voce', 'Novità');
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Novità della versione 0.1.0');
    assert.equal(await run(() => document.querySelectorAll('[role=dialog] .novita li').length), 2);
    await clicca('[role=dialog] button', 'Chiudi');
    await wait(() => !document.querySelector('[role=dialog]'));
  });

  await check('ACCOUNT: «Rimuovi» chiede conferma; Annulla non toglie, Rimuovi sì e dà «Annulla»', async () => {
    await carica({ vista: 'impostazioni', sezione: 'account' });
    await wait(() => document.querySelectorAll('.riga.azione').length === 2);
    const prima = finto.chiamateImp.length;
    await run(() => [...document.querySelectorAll('.riga.azione button')].find((b) => b.textContent === 'Rimuovi').click());
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Rimuovere la cartella?');
    assert.ok((await run(() => document.querySelector('[role=dialog]').textContent)).includes('Smetto di leggere le sessioni di ~/.claude-uno. I file restano dove sono.'));
    await clicca('[role=dialog] button', 'Annulla');
    await wait(() => !document.querySelector('[role=dialog]'));
    assert.equal(finto.chiamateImp.length, prima);
    await run(() => [...document.querySelectorAll('.riga.azione button')].find((b) => b.textContent === 'Rimuovi').click());
    await wait(() => !!document.querySelector('[role=dialog]'));
    await clicca('[role=dialog] button', 'Rimuovi');
    await wait(() => !document.querySelector('[role=dialog]'));
    assert.deepEqual(finto.chiamateImp.at(-1), { accountTolti: ['~/.claude-uno'] });
    await wait(() => document.body.innerText.includes('Cartella rimossa'));
  });

  await check('INFO: «Novità della versione» apre lo stesso dialogo, al centro della finestra', async () => {
    await carica({ vista: 'impostazioni', sezione: 'info' });
    await wait(() => document.body.innerText.includes('Note di rilascio'));
    await run(() => [...document.querySelectorAll('.valore-scelta')].find((b) => b.textContent.includes('Novità della versione')).click());
    await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal(await dialogo(), 'Novità della versione 0.1.0');
    assert.equal(await run(() => getComputedStyle(document.querySelector('.velo')).paddingBottom), '0px');
  });

  await check('CHIP: «Carico…» e «Troppo grande» nella casella; con un file in lettura il messaggio non parte', async () => {
    await carica({ vista: 'sessione', sessione: 'a', sezione: 'scritta:Guarda questi|allegati' });
    await wait(() => document.querySelectorAll('.chip-allegato').length === 4);
    assert.deepEqual(await run(() => [...document.querySelectorAll('.chip-allegato .dettaglio')].map((e) => e.textContent)), ['4 KB', '312 KB', 'Carico…', 'Troppo grande']);
    assert.equal(await run(() => document.querySelector('.bottone-invia').disabled), true);
    await run(() => document.querySelector('button[aria-label="Rimuovi registro.log"]').click());
    await wait(() => document.querySelectorAll('.chip-allegato').length === 3);
    assert.equal(await run(() => document.querySelector('.bottone-invia').disabled), false);
  });

  assert.equal(mostrate, 0, 'nessun evento show'); assert.equal(fuochi, 0, 'nessun evento focus');
  assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false); assert.equal(win.webContents.isAudioMuted(), true);
  console.log(`HIDDEN_WINDOW_OK shows=${mostrate} focus=${fuochi}`);
  console.log(`AZIONI_460_RIEPILOGO ok=${risultati.filter(Boolean).length} fail=${risultati.filter((x) => !x).length}`);
  app.exit(risultati.every(Boolean) ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
