// Stati di clotch AI nel renderer vero (101-36642, 36832, 37055, 37278, 37492): finestra invisibile e muta, IPC intercettato.
// Solo dati finti del registro: nessun microfono, nessuna voce, nessun comando vero.
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
  const ORA = Date.now(), MIN = 60_000;
  const chat = (id, progetto, stato, extra = {}) => ({ chat: id, titolo: `${progetto}: ${id}`, madre: null, progetto, account: null, sorgente: null, daHandoff: null, stato,
    dettaglio: null, aspetto: null, domanda: null, limite: null, richieste: [], battito: ORA, aiutanti: {}, compattazioni: 0, interrotta: null, coda: [], obiettivo: null,
    passi: [], visto: ORA, fine: null, fineT: null, chatNuova: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0, ...extra });
  const registro = (extra = {}) => ({ chat: { friday: chat('friday', '', 'lavora'), a: chat('a', 'clotch', 'lavora'), b: chat('b', 'squadd-v2', 'serve_roberto') }, // nome del protocollo del motore
    fermoTutto: false, avvisi: [], clotch: null, clotchAi: { evento: 'avvio', t: ORA }, comandi: [], decisioni: [], regole: [], nonDisturbare: null,
    impostazioni: null, esiti: {}, errori: [], ...extra });
  const scena = { navigazione: { vista: 'clotch-ai' }, elenco: { sessioni: [], errori: [] }, messaggi: {}, preferenze: {}, registro: registro() };
  collegaScena(ipcMain, scena);
  const comandi = [];
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { esito: 'ok', testo: '' }; });
  const dettature = []; // il main non apre il microfono: registra solo avvia (true) e ferma (false)
  ipcMain.removeHandler('clotch-ai:dettatura');
  ipcMain.handle('clotch-ai:dettatura', (_e, avvia) => { dettature.push(avvia); });
  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  let mostrate = 0, focalizzate = 0;
  win.on('show', () => mostrate++);
  win.on('focus', () => focalizzate++);
  const run = (fn, ...args) => win.webContents.executeJavaScript(`(${fn})(...${JSON.stringify(args)})`);
  const wait = (fn) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => { if ((${fn})()) resolve(); else if (Date.now() > end) reject(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn))})); else setTimeout(tick, 20); };
    tick();
  })`);
  const carica = async (r, extra = {}) => {
    Object.assign(scena, { registro: r, voce: false, ...extra });
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'clotch-ai' } });
    await wait(() => !!document.querySelector('.intestazione-clotch-ai .stato span'));
  };
  const testo = (sel) => run((s) => document.querySelector(s)?.textContent ?? null, sel);
  const stato = () => testo('.intestazione-clotch-ai .stato span');
  const fallite = [];
  const check = async (nome, prova) => { try { await prova(); console.log(`${nome}: OK`); } catch (e) { fallite.push(`${nome}: ${e.message}`); console.error(`FAIL ${nome}: ${e.message}`); } };
  try {
    await check('PRIMA_APERTURA', async () => {
      await carica(registro({ clotchAi: { evento: 'avvio', t: ORA } }));
      await wait(() => !!document.querySelector('.prima-apertura'));
      assert.equal(await testo('.prima-apertura .titolo'), 'Cosa vuoi sapere?');
      const chips = await run(() => [...document.querySelectorAll('.prima-apertura .suggerimento')].map((b) => b.textContent));
      assert.deepEqual(chips, ['Cosa aspetta me?', 'Ferma le sessioni di clotch', 'Com’è messo squadd-v2?']);
      await run(() => document.querySelectorAll('.prima-apertura .suggerimento')[1].click());
      await new Promise((ok) => setTimeout(ok, 200));
      assert.deepEqual(comandi.at(-1), { cmd: 'parla', args: { testo: 'Ferma le sessioni di clotch' } });
    });
    await check('TI_ASCOLTA', async () => {
      await carica(registro({ clotch: { voce: 'accesa', parla: false, ascolta: true, t: ORA } }));
      await wait(() => !!document.querySelector('.casella-voce.ascolta'));
      assert.equal(await stato(), 'Ti ascolta');
      assert.equal(await run(() => !!document.querySelector('.area-casella textarea')), false, 'la casella voce prende il posto della casella');
      assert.equal(await run(() => document.querySelectorAll('.casella-voce .barra').length), 8);
      await run(() => document.querySelector('.casella-voce button').click()); // «Fine»: con Clotch è la stessa pressione di ⌥Spazio
      await new Promise((ok) => setTimeout(ok, 200));
      assert.equal(comandi.at(-1).cmd, 'clotch_dettatura');
    });
    await check('STA_PARLANDO_CLOTCH', async () => {
      await carica(registro({ clotch: { voce: 'accesa', parla: true, ascolta: false, t: ORA } }));
      await wait(() => !!document.querySelector('.casella-voce.parla'));
      assert.equal(await stato(), 'Sta parlando');
      await run(() => document.querySelector('.casella-voce button').click()); // «Interrompi»
      await new Promise((ok) => setTimeout(ok, 200));
      assert.equal(comandi.at(-1).cmd, 'zitto', 'Interrompi con Clotch è il comando del motore');
    });
    await check('ZITTO_RIFIUTATO_NELL_AVVISO', async () => { // Clotch chiusa: il rifiuto del motore arriva a Roberto con il suo testo
      await carica(registro({ clotch: { voce: 'accesa', parla: true, ascolta: false, t: ORA } }));
      await wait(() => !!document.querySelector('.casella-voce.parla'));
      ipcMain.removeHandler('clotch-ai:comando');
      ipcMain.handle('clotch-ai:comando', () => ({ esito: 'rifiutato', testo: 'Clotch non è aperta.' }));
      await run(() => document.querySelector('.casella-voce button').click());
      await wait(() => document.body.textContent.includes('Clotch non è aperta.'));
      ipcMain.removeHandler('clotch-ai:comando');
      ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { esito: 'ok', testo: '' }; });
    });
    await check('TESTO_DI_CLOTCH_DAL_VIVO', async () => { // il parziale del registro finisce nella stessa vista della dettatura; senza testo torna «Parla…»
      await carica(registro({ clotch: { voce: 'accesa', parla: false, ascolta: true, t: ORA, testo: 'apri il notch' } }));
      await wait(() => document.querySelector('.casella-voce .testo')?.textContent === 'apri il notch');
      await carica(registro({ clotch: { voce: 'accesa', parla: false, ascolta: true, t: ORA } }));
      await wait(() => document.querySelector('.casella-voce .testo')?.textContent === 'Parla…');
    });
    await check('STA_PARLANDO_APP_INTERROMPI', async () => {
      await carica(registro({ voceApp: true }), { voce: true });
      await wait(() => !!document.querySelector('.casella-voce.parla button'));
      assert.equal(await testo('.casella-voce .testo'), 'clotch AI sta parlando');
      await run(() => document.querySelector('.casella-voce.parla button').click());
      await new Promise((ok) => setTimeout(ok, 200));
      assert.equal(comandi.at(-1).cmd, 'voce_ferma', 'Interrompi ferma il `say` dell\'app dal main');
    });
    await check('MICROFONO_NON_DISPONIBILE', async () => {
      await carica(registro({ impostazioni: { attiva: true, microfono: '', microfoni_disponibili: [], voci_disponibili: ['Italiana'] } }));
      await wait(() => !!document.querySelector('.avviso-f'));
      assert.equal(await stato(), 'Microfono non disponibile');
      assert.match(await testo('.avviso-f'), /Microfono non disponibile.*Intanto puoi scrivere/);
      assert.equal(await run(() => !!document.querySelector('.area-casella textarea')), true, 'si può ancora scrivere');
    });
    await check('PERMESSO_DELLA_SESSIONE', async () => {
      const q = { rid: 'q1', genere: 'permesso', strumento: 'Bash', ingresso: { command: 'supabase db push --db-url $DEV', description: 'Porta su dev la migrazione 0042 delle policy.' }, domande: [] };
      const r = registro({ avvisi: [{ id: 'a0', t: ORA - 2 * MIN, testo: '«Backend: auth e RLS» aspetta un tuo permesso da 12 minuti.', livello: 'normale', motivo: 'domanda', dettoDa: 'app', sessioni: [] }] });
      r.chat.b = chat('b', 'squadd-v2', 'serve_roberto', { titolo: 'Backend: auth e RLS', richieste: [q] });
      await carica(r);
      await wait(() => !!document.querySelector('.carta-richiesta'));
      assert.equal(await testo('.carta-richiesta .titolo'), 'Backend: auth e RLS chiede un permesso');
      assert.equal(await run(() => !!document.querySelector('.prima-apertura')), false, 'con un avviso e un permesso la chat non è vuota');
      assert.match(await testo('.risposta-clotch-ai'), /aspetta un tuo permesso da 12 minuti/);
      await run(() => [...document.querySelectorAll('.carta-richiesta button')].find((b) => b.textContent === 'Consenti sempre').click());
      await new Promise((ok) => setTimeout(ok, 200));
      assert.deepEqual(comandi.at(-1), { cmd: 'rispondi_permesso', args: { chat: 'b', rid: 'q1', scelta: 'consenti_sempre' } });
    });
    const detta = () => run(() => document.querySelector('button[aria-label="Detta"]').click());
    const pausa = () => new Promise((ok) => setTimeout(ok, 200));
    await check('DETTATURA_APP_CLOTCH_SPENTO', async () => { // il main apre il microfono (qui un finto): la pagina chiede e riceve il testo
      await carica(registro());
      const prima = comandi.length;
      await detta();
      await wait(() => !!document.querySelector('.casella-voce.ascolta'));
      assert.deepEqual(dettature, [true]);
      win.webContents.send('clotch-ai:dettatura', { testo: 'ciao dall’app' });
      await wait(() => document.querySelector('.casella-voce .testo')?.textContent === 'ciao dall’app');
      assert.equal(comandi.length, prima, 'nessun segnale a Clotch');
      await run(() => document.querySelector('.casella-voce > button:last-child').click()); // «Fine»
      await pausa();
      assert.deepEqual(dettature, [true, false]);
      assert.deepEqual(comandi.at(-1), { cmd: 'parla', args: { testo: 'ciao dall’app' } });
    });
    await check('DETTATURA_APP_ERRORE_DAL_MAIN', async () => {
      await carica(registro());
      dettature.length = 0;
      await detta();
      await wait(() => !!document.querySelector('.casella-voce.ascolta'));
      win.webContents.send('clotch-ai:dettatura', { fine: true, errore: 'Microfono non consentito' });
      await wait(() => !document.querySelector('.casella-voce.ascolta'));
      await wait(() => document.body.textContent.includes('Microfono non consentito'));
    });
    await check('DETTATURA_CLOTCH_ACCESO_NESSUN_ESEGUIBILE', async () => {
      await carica(registro({ clotch: { voce: 'accesa', parla: false, ascolta: false, t: ORA } }));
      dettature.length = 0;
      await detta();
      await pausa();
      assert.equal(comandi.at(-1).cmd, 'clotch_dettatura');
      assert.deepEqual(dettature, [], 'con Clotch acceso il main non apre niente');
    });
    await check('DETTATURA_APP_ESC_ANNULLA_E_FUOCO_SU_FINE', async () => { // #743: Esc butta la dettatura, il fuoco va su «Fine» e torna a «Detta»
      await carica(registro());
      dettature.length = 0; const prima = comandi.length;
      await detta();
      await wait(() => document.activeElement?.textContent === 'Fine');
      win.webContents.send('clotch-ai:dettatura', { testo: 'da buttare' });
      await run(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
      await wait(() => !document.querySelector('.casella-voce'));
      assert.deepEqual(dettature, [true, false]);
      assert.equal(comandi.length, prima, 'Annulla non manda niente');
      await wait(() => document.activeElement?.getAttribute('aria-label') === 'Detta');
    });
    await check('DETTATURA_APP_ERRORE_SALVA_IL_TESTO', async () => { // #744: l'errore non butta il testo già detto, finisce nella casella
      await carica(registro());
      await detta();
      await wait(() => !!document.querySelector('.casella-voce.ascolta'));
      win.webContents.send('clotch-ai:dettatura', { testo: 'testo già detto' });
      await wait(() => document.querySelector('.casella-voce .testo')?.textContent === 'testo già detto');
      win.webContents.send('clotch-ai:dettatura', { fine: true, errore: 'Dettatura interrotta' });
      await wait(() => document.querySelector('.area-casella textarea')?.value === 'testo già detto');
    });
    await check('DETTATURA_APP_FINE_SENZA_TESTO', async () => {
      await carica(registro());
      const prima = comandi.length;
      await detta();
      await wait(() => !!document.querySelector('.casella-voce.ascolta'));
      await run(() => document.querySelector('.casella-voce > button:last-child').click());
      await wait(() => document.body.textContent.includes('Nessuna parola sentita'));
      assert.equal(comandi.length, prima);
    });
    assert.deepEqual(fallite, []);
    assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false);
    assert.equal(win.webContents.isAudioMuted(), true);
    assert.equal(mostrate, 0); assert.equal(focalizzate, 0);
    console.log('CLOTCH_AI_VOCE_OK shows=0 focus=0'); app.exit(0);
  } catch (error) { console.error(error); console.log('FAIL clotch-ai-voce'); app.exit(1); }
});
