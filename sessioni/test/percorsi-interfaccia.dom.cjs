// Percorsi d'uso del renderer vero (#456): finestra nascosta, IPC simulato, nessun dato o comando reale.
// Un difetto noto dell'interfaccia è un check `noto: 'ID'`: se fallisce stampa DEFECT_OPEN (uscita 2), se passa DEFECT_FIXED.
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
const { creaCronologiaScena } = require(path.join(root, 'dist/src/scena-cronologia.js'));

const scene = JSON.parse(JSON.stringify(require('../design/scene/101-14849.json')));
const base = scene.elenco.sessioni[0], ora = Date.now();
const sess = (id, titolo, sorgente, stato, dt) => ({ ...base, id, titolo, sorgente, stato, ultimaAttivita: ora - dt });
scene.elenco.sessioni = [sess('s1', 'Alfa uno', 'claude-code', 'lavora', 3000), sess('s2', 'Beta due', 'codex', 'finita', 1000), sess('s3', 'Gamma tre', 'claude-code', 'aspetta', 2000)];
const utente = (testo) => ({ tipo: 'utente', testo, t: null });
const fonti = { s1: [utente('Messaggio A uno')], s2: [utente('Messaggio B due')], s3: [utente('Messaggio C tre')] };
scene.messaggi = fonti;
const storia = creaCronologiaScena((id) => fonti[id] ?? []);

// stato modificabile dai check: cosa risponde il finto main
const finto = { tieni: false, trattenute: [], messaggi: null, elenco: null, cerca: null, letture: 0 };
const log = { console: [], main: [], eccezioni: [] };
process.on('uncaughtException', (e) => log.eccezioni.push(String(e && e.stack || e)));
process.stderr.write = (s) => { log.main.push(String(s)); return true; }; // gli errori attesi non sporcano il riepilogo; quelli nuovi falliscono il check

let win, mostrate = 0, fuochi = 0;
const nuovaFinestra = () => {
  const w = new BrowserWindow({ show: false, focusable: false, width: 1800, height: 1000, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  w.on('show', () => mostrate++); w.on('focus', () => fuochi++);
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('console-message', (...a) => log.console.push(a.length > 1 ? { level: ['verbose', 'info', 'warning', 'error'][a[1]] || 'info', message: a[2] } : { level: a[0].level, message: a[0].message }));
  w.webContents.on('render-process-gone', (_e, d) => log.eccezioni.push('render-process-gone ' + d.reason));
  return w;
};
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
const run = async (fn, ...a) => {
  const r = await win.webContents.executeJavaScript(`(async () => { try { return { v: await (${fn})(...${JSON.stringify(a)}) }; } catch (e) { return { e: String(e && e.message || e) }; } })()`);
  if (r.e) throw new Error(r.e);
  return r.v;
};
const wait = (fn, ...a) => win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 4000; const f = ${fn};
  const t = () => { let v = false; try { v = f(...${JSON.stringify(a)}); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 110))})) : setTimeout(t, 15); }; t(); })`);
const invia = (a) => win.webContents.send('sessioni:aggiornamento', { sessioni: [], nuoviMessaggi: [], ...a });
const clicca = (sel, testo) => run((sel, testo) => { const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').trim() === testo); if (!el) throw new Error('manca ' + sel + ' ' + testo); el.click(); }, sel, testo);
const scrivi = (sel, testo) => run((sel, testo) => { const el = document.querySelector(sel);
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, testo); el.dispatchEvent(new Event('input', { bubbles: true })); }, sel, testo);
const apri = (titolo) => clicca('.riga-sessione .testo', titolo);
const testoChat = () => run(() => [...document.querySelectorAll('.messaggio-roberto .bolla')].map((e) => e.textContent));
const titolo = () => run(() => document.querySelector('.superficie')?.firstElementChild?.textContent || '');
const radiceViva = () => run(() => document.getElementById('radice').children.length > 0 && document.body.innerText.length > 0);
const sidebar = () => run(() => [...document.querySelectorAll('.riga-sessione .testo')].map((e) => e.textContent));
const rilascia = (i) => { const t = finto.trattenute[i]; t.res(t.r); };

const carica = (q = { vista: 'sessione', sessione: 's1' }) => win.loadFile(path.join(root, 'renderer/index.html'), { query: q });
const caricaChat = async (id = 's1', att = 'Messaggio A uno') => { await carica({ vista: 'sessione', sessione: id }); await wait((t) => document.querySelector('.messaggio-roberto .bolla')?.textContent === t, att); };

const risultati = [];
async function check(nome, fn, { noto, consenti = /^$/ } = {}) {
  Object.assign(finto, { tieni: false, trattenute: [], messaggi: null, elenco: null, cerca: null });
  const c0 = log.console.length, m0 = log.main.length, e0 = log.eccezioni.length;
  let errore = null;
  try {
    await fn();
    const rumore = [...log.console.slice(c0).filter((m) => m.level === 'warning' || m.level === 'error').map((m) => 'console: ' + m.message), ...log.main.slice(m0).filter((s) => !consenti.test(s)).map((s) => 'main: ' + s), ...log.eccezioni.slice(e0)];
    const nuovi = rumore.filter((s) => !consenti.test(s));
    assert.deepEqual(nuovi, [], 'errori o warning nuovi: ' + nuovi.slice(0, 2).join(' | ').replace(/\s+/g, ' ').slice(0, 300));
  } catch (e) { errore = e; }
  const stato = !errore ? (noto ? 'DEFECT_FIXED' : 'OK') : noto ? 'DEFECT_OPEN' : 'FAIL';
  risultati.push({ nome, stato, noto });
  console.log(`${stato} ${nome}${noto ? ` [${noto}]` : ''}${errore ? ': ' + String(errore.message).split('\n')[0].slice(0, 220) : ''}`);
}

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  ipcMain.removeHandler('sessioni:messaggi'); ipcMain.removeHandler('sessioni:elenco'); ipcMain.removeHandler('sessioni:cerca'); ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', () => ({ esito: 'ok' }));
  ipcMain.handle('sessioni:elenco', () => (finto.elenco ? finto.elenco() : scene.elenco));
  ipcMain.handle('sessioni:cerca', (_e, testo) => (finto.cerca ? finto.cerca(testo) : []));
  ipcMain.handle('sessioni:messaggi', (_e, id, pagina, opz) => {
    finto.letture++;
    const r = storia.pagina(id, pagina, opz);
    if (finto.messaggi) return finto.messaggi(id, r);
    return finto.tieni ? new Promise((res) => finto.trattenute.push({ id, r, res })) : r;
  });
  win = nuovaFinestra();

  await check('IMPOSTAZIONI_E_INDIETRO', async () => {
    await caricaChat();
    await run(() => document.querySelector('textarea').focus());
    await scrivi('textarea', 'bozza viva');
    for (const [et] of [['Impostazioni'], ['Indietro'], ['Avanti'], ['Indietro'], ['Indietro'], ['Avanti'], ['Indietro']]) {
      await run((e) => document.querySelector(`button[aria-label="${e}"]`)?.click(), et); await attesa(15);
    }
    await wait(() => !!document.querySelector('.area-casella textarea') && !document.querySelector('.nav-impostazioni'));
    assert.deepEqual(await testoChat(), ['Messaggio A uno']);
    assert.equal(await run(() => document.querySelector('textarea').value), 'bozza viva');
    assert.equal(await run(() => document.querySelector('.riga-sessione.scelta .testo')?.textContent), 'Alfa uno');
  });

  await check('CAMBI_RAPIDI_DURANTE_CARICAMENTO', async () => {
    finto.tieni = true;
    await carica({ vista: 'sessione', sessione: 's1' });
    await wait(() => document.querySelectorAll('.riga-sessione').length === 3);
    for (const t of ['Beta due', 'Gamma tre', 'Alfa uno', 'Beta due']) { await apri(t); await attesa(5); }
    assert.deepEqual(await testoChat(), [], 'nessun messaggio mentre carica');
    assert.equal(await run(() => !!document.querySelector('.sagome')), true, 'sagome di caricamento');
    for (const i of finto.trattenute.map((_, i) => i).reverse()) rilascia(i); // risposte in ordine inverso
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'Messaggio B due');
    await attesa(80);
    assert.deepEqual(await testoChat(), ['Messaggio B due']);
    assert.match(await titolo(), /Beta due/);
  });

  await check('RISPOSTA_TARDIVA_NELLA_CHAT_GIUSTA', async () => {
    await caricaChat(); finto.tieni = true; finto.trattenute = [];
    await apri('Beta due'); await attesa(60);
    const dueA = finto.trattenute.findIndex((t) => t.id === 's2'); rilascia(dueA);
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'Messaggio B due');
    await apri('Alfa uno'); await attesa(60);
    const tardiva = finto.trattenute.length - 1; // la lettura di s1 resta ferma
    await apri('Gamma tre'); await attesa(60);
    rilascia(tardiva); await attesa(100); // arriva dopo il cambio: non deve apparire sotto Gamma
    assert.deepEqual(await testoChat(), []);
    rilascia(finto.trattenute.length - 1);
    await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'Messaggio C tre');
    assert.deepEqual(await testoChat(), ['Messaggio C tre']);
  });

  await check('BOZZE_SEPARATE_CON_CAMBI_RAPIDI', async () => {
    await caricaChat();
    for (const [t, testo] of [['Alfa uno', 'uno <img src=x onerror=1>'], ['Beta due', 'due'], ['Gamma tre', 'tre\nriga']]) {
      await apri(t); await wait(() => !!document.querySelector('textarea')); await scrivi('textarea', testo);
    }
    for (let i = 0; i < 12; i++) { await apri(['Alfa uno', 'Beta due', 'Gamma tre'][i % 3]); }
    for (const [t, testo] of [['Alfa uno', 'uno <img src=x onerror=1>'], ['Beta due', 'due'], ['Gamma tre', 'tre\nriga']]) {
      await apri(t); await wait((x) => document.querySelector('textarea')?.value === x, testo);
    }
    assert.equal(await run(() => document.querySelectorAll('textarea img, .area-casella img').length), 0);
  });

  await check('PANNELLI_E_BARRA', async () => {
    await caricaChat(); await wait(() => !!document.querySelector('.pannello'));
    await scrivi('textarea', 'resta');
    await run(() => document.querySelector('button[aria-label="Barra laterale"]').click());
    await wait(() => !document.querySelector('.barra-laterale') && !!document.querySelector('.pannello'));
    win.setSize(1024, 1000); await wait(() => !document.querySelector('.pannello'));
    win.setSize(1800, 1000); await wait(() => !!document.querySelector('.pannello'));
    await run(() => document.querySelector('button[aria-label="Barra laterale"]').click());
    await wait(() => !!document.querySelector('.barra-laterale'));
    assert.equal(await run(() => document.querySelector('textarea').value), 'resta');
    assert.deepEqual(await testoChat(), ['Messaggio A uno']);
  });

  await check('FILTRI_E_RAGGRUPPA', async () => {
    await caricaChat();
    await clicca('.barra-laterale .riga .testo', 'Filtra');
    await clicca('.menu .voce .etichetta', 'Aggiungi filtro');
    await clicca('.menu-filtro .voce .etichetta', 'Sorgente');
    await clicca('.menu-filtro .voce .etichetta', 'Codex');
    await run(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.deepEqual(await sidebar(), ['Beta due'], 'solo Codex');
    assert.match(await run(() => document.querySelector('.pillola-filtro')?.textContent || ''), /Sorgente:\s*Codex/);
    await clicca('.pillola-filtro .apri', 'Sorgente:Codex'); await clicca('.menu-filtro .voce .etichetta', 'Codex'); // tolta la spunta: nessun filtro
    await run(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.deepEqual(await sidebar(), ['Beta due', 'Gamma tre', 'Alfa uno'], 'ordine per ultima attività');
    await clicca('.barra-laterale .riga .testo', 'Filtra'); await clicca('.menu .voce .etichetta', 'Nome');
    await run(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.deepEqual(await sidebar(), ['Alfa uno', 'Beta due', 'Gamma tre'], 'ordine per nome');
  });

  await check('FILTRO_MOSTRA_I_RISULTATI', async () => {
    await caricaChat();
    await clicca('.barra-laterale .riga .testo', 'Filtra'); await clicca('.menu .voce .etichetta', 'Aggiungi filtro');
    await clicca('.menu-filtro .voce .etichetta', 'Sorgente'); await clicca('.menu-filtro .voce .etichetta', 'Codex');
    await run(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.deepEqual(await sidebar(), ['Beta due'], 'dopo il filtro la sessione trovata è visibile senza aprire la cartella');
  });

  await check('FILTRO_RESTA_DOPO_IMPOSTAZIONI', async () => {
    await caricaChat();
    await clicca('.barra-laterale .riga .testo', 'Filtra'); await clicca('.menu .voce .etichetta', 'Aggiungi filtro');
    await clicca('.menu-filtro .voce .etichetta', 'Sorgente'); await clicca('.menu-filtro .voce .etichetta', 'Codex');
    await run(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await run(() => document.querySelector('.piede-account button[aria-label="Impostazioni"]').click());
    await wait(() => !!document.querySelector('[role=menu] .voce'));
    await run(() => [...document.querySelectorAll('[role=menu] .voce')].find((e) => e.textContent.startsWith('Impostazioni')).click());
    await wait(() => !!document.querySelector('.nav-impostazioni'));
    await run(() => document.querySelector('button[aria-label="Indietro"]').click());
    await wait(() => !!document.querySelector('.barra-laterale'));
    assert.equal(await run(() => !!document.querySelector('.pillola-filtro')), true, 'il filtro scelto è ancora attivo');
  });

  await check('FILTRI_CHE_ESCLUDONO_TUTTO', async () => {
    await caricaChat();
    await clicca('.barra-laterale .riga .testo', 'Filtra'); await clicca('.menu .voce .etichetta', 'Aggiungi filtro');
    await clicca('.menu-filtro .voce .etichetta', 'Stato'); await clicca('.menu-filtro .voce .etichetta', 'Errore');
    await run(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.deepEqual(await sidebar(), []);
    assert.match(await run(() => document.querySelector('.elenco')?.innerText || ''), /0 sessioni|nessun/i, 'serve un testo che dica perché l\'elenco è vuoto');
  });

  const apriRicerca = async () => { await clicca('.barra-laterale .riga .testo', 'Cerca sessioni'); await wait(() => !!document.querySelector('.finestra-ricerca input')); };
  await check('RICERCA_TITOLO_E_MESSAGGIO', async () => {
    await caricaChat(); finto.cerca = (t) => (t === 'pippo' ? [{ id: 's2', nelTitolo: false, frammento: '…ha detto pippo davvero…', t: null }] : []);
    await apriRicerca(); await scrivi('.finestra-ricerca input', 'gamma');
    await wait(() => document.querySelector('.risultato .testo')?.textContent === 'Gamma tre');
    await run(() => document.querySelector('.finestra-ricerca').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    await wait((t) => document.querySelector('.messaggio-roberto .bolla')?.textContent === t, 'Messaggio C tre');
    await apriRicerca(); await scrivi('.finestra-ricerca input', 'pippo');
    await wait(() => /ha detto pippo/.test(document.querySelector('.risultato .t-sm')?.textContent || ''));
    await run(() => document.querySelector('.finestra-ricerca').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await wait(() => !document.querySelector('.finestra-ricerca'));
  });

  await check('RICERCA_RISPOSTE_FUORI_ORDINE_E_ERRORE', async () => {
    await caricaChat(); const ferme = {};
    finto.cerca = (t) => (t === 'x' ? Promise.reject(new Error('indice rotto')) : new Promise((res) => { ferme[t] = res; }));
    await apriRicerca(); await scrivi('.finestra-ricerca input', 'g'); await attesa(30); await scrivi('.finestra-ricerca input', 'ga'); await attesa(30);
    ferme.ga([{ id: 's2', nelTitolo: false, frammento: 'risposta nuova', t: null }]); await attesa(40);
    ferme.g([{ id: 's3', nelTitolo: false, frammento: 'risposta vecchia', t: null }]); await attesa(80);
    const t = await run(() => document.querySelector('.risultati').innerText);
    assert.ok(!/risposta vecchia/.test(t), 'la risposta della ricerca precedente non entra');
    await scrivi('.finestra-ricerca input', 'x'); await attesa(80);
    assert.equal(await radiceViva(), true);
  }, { consenti: /indice rotto|Error occurred in handler/ });

  await check('RICERCA_TESTO_OSTILE', async () => {
    await caricaChat(); finto.cerca = () => []; await apriRicerca();
    for (const q of ['<img src=x onerror="window.__x=1">', '(((', '[a-', '\\', 'a'.repeat(60000), 'x\u0000y\u0007‮', '"; DROP', '${7*7}']) {
      await scrivi('.finestra-ricerca input', q); await attesa(25);
      assert.equal(await run(() => document.querySelectorAll('.finestra-ricerca img, .finestra-ricerca script').length), 0);
      assert.equal(await run(() => !!window.__x), false);
    }
    assert.match(await run(() => document.querySelector('.nessun-risultato')?.innerText || ''), /Nessun risultato/);
  });

  const errori = [['reject', () => { throw new Error('boom lettura'); }], ['null', () => null], ['vuota', () => ({})],
    ['messaggi-stringa', () => ({ messaggi: 'x', pagina: 0, haAltre: false, errore: null, totale: 1 })], ['senza-cronologia', (_id, r) => ({ ...r, cronologia: undefined })],
    ['altra-sessione', (_id, r) => ({ ...r, cronologia: { ...r.cronologia, sessione: 'sX' } })], ['righe-non-array', (_id, r) => ({ ...r, cronologia: { ...r.cronologia, righe: 'x' } })]];
  for (const [nome, f] of errori) {
    await check('ERRORE_IPC_MESSAGGI_' + nome.toUpperCase(), async () => {
      finto.messaggi = (id, r) => f(id, r);
      await carica({ vista: 'sessione', sessione: 's1' });
      await wait(() => /Messaggi non letti/.test(document.body.innerText));
      assert.equal(await radiceViva(), true);
      finto.messaggi = null; await clicca('.messaggio-al-centro button', 'Riprova');
      await wait(() => document.querySelector('.messaggio-roberto .bolla')?.textContent === 'Messaggio A uno');
    }, { consenti: /boom lettura|Error occurred in handler/ });
  }

  await check('ELENCO_RIFIUTATO_MOSTRA_ERRORE_E_RIPROVA', async () => {
    finto.elenco = () => { throw new Error('elenco rotto'); }; await carica({ vista: 'sessione', sessione: 's1' });
    await wait(() => /Sessioni non lette/.test(document.body.innerText));
    finto.elenco = null; await clicca('.messaggio-al-centro button', 'Riprova');
    await wait((t) => document.querySelector('.messaggio-roberto .bolla')?.textContent === t, 'Messaggio A uno');
  }, { consenti: /elenco rotto|Error occurred in handler/ });

  await check('TRASCRIZIONE_SU_ALTRO_COMPUTER_DICE_DOVE_E', async () => { // #996: sessione dell'app Claude via ssh, senza copia sul Mac
    const remota = { ...scene.elenco, sessioni: scene.elenco.sessioni.map((x) => x.id === 's1' ? { ...x, sorgente: 'claude-desktop', file: '/x/local_1.json', app: { padre: null, prs: [], connettori: [], strumentiMcp: 0, cli: null, ospite: 'sandbox-app@10.0.0.1', remoto: false } } : x) };
    finto.elenco = () => remota;
    finto.messaggi = (_id, r) => ({ ...r, messaggi: [], errore: 'trascrizione non trovata sul disco', cronologia: undefined });
    await carica({ vista: 'sessione', sessione: 's1' });
    await wait(() => /Messaggi non letti/.test(document.body.innerText));
    assert.match(await run(() => document.querySelector('.messaggio-al-centro').innerText), /la trascrizione è su sandbox-app@10\.0\.0\.1, non su questo Mac/);
  }, { consenti: /Error occurred in handler/ });

  await check('AGGIORNAMENTO_DAL_VIVO_CURSORE_E_BOZZA', async () => {
    await caricaChat(); await run(() => document.querySelector('textarea').focus()); await scrivi('textarea', 'abcdefghij');
    await run(() => { const t = document.querySelector('textarea'); t.focus(); t.setSelectionRange(3, 6); });
    let seq = 1; scene.elenco.sessioni[0].titolo = 'Alfa uno aggiornato';
    for (let i = 0; i < 25; i++) {
      invia({ sessioni: ['s1'], cronologia: [{ tipo: 'upsert', sessione: 's1', epoca: 'fixture:s1', daSeq: seq, aSeq: seq + 1, totale: 1 + i + 1,
        righe: [{ chiave: `live:${i}`, ordine: 10 + i, revisione: seq + 1, messaggio: utente('live ' + i) }] }] }); seq++;
      if (i % 5 === 0) await attesa(20);
    }
    await wait(() => [...document.querySelectorAll('.messaggio-roberto .bolla')].some((e) => e.textContent === 'live 24'));
    await wait(() => [...document.querySelectorAll('.riga-sessione .testo')].some((e) => e.textContent === 'Alfa uno aggiornato'));
    const s = await run(() => { const t = document.querySelector('textarea'); return [t.value, t.selectionStart, t.selectionEnd, document.activeElement === t]; });
    assert.deepEqual(s, ['abcdefghij', 3, 6, true]);
    scene.elenco.sessioni[0].titolo = 'Alfa uno';
  });

  await check('FINESTRA_CHIUSA_E_RIAPERTA', async () => {
    await caricaChat(); finto.tieni = true; await carica({ vista: 'sessione', sessione: 's1' }); await attesa(200);
    win.webContents.reload(); await attesa(300);
    finto.tieni = false; for (let i = 0; i < finto.trattenute.length; i++) rilascia(i); // risposte di una pagina che non c'è più
    scene.elenco.sessioni[1].titolo = 'Beta due nuovo';
    const vecchia = win; invia({ sessioni: ['s2'] }); vecchia.destroy();
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('sessioni:aggiornamento', { sessioni: ['s2'], nuoviMessaggi: [] })); // finestra chiusa: il main non deve rompersi
    win = nuovaFinestra();
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: 's2' } });
    await wait((t) => document.querySelector('.messaggio-roberto .bolla')?.textContent === t, 'Messaggio B due');
    assert.ok((await sidebar()).includes('Beta due nuovo'));
    assert.equal(await run(() => document.querySelector('textarea').value), '', 'le bozze non sopravvivono alla finestra');
    scene.elenco.sessioni[1].titolo = 'Beta due';
  });

  assert.equal(mostrate, 0, 'nessun evento show'); assert.equal(fuochi, 0, 'nessun evento focus');
  assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false); assert.equal(win.webContents.isAudioMuted(), true);
  const aperti = risultati.filter((r) => r.stato === 'DEFECT_OPEN'), rotti = risultati.filter((r) => r.stato === 'FAIL');
  console.log(`HIDDEN_WINDOW_OK shows=${mostrate} focus=${fuochi}`);
  console.log(`PERCORSI_RIEPILOGO ok=${risultati.filter((r) => r.stato === 'OK').length} fail=${rotti.length} difetti_aperti=${aperti.length} difetti_chiusi=${risultati.filter((r) => r.stato === 'DEFECT_FIXED').length}`);
  app.exit(rotti.length ? 1 : aperti.length ? 2 : 0);
}).catch((e) => { console.error(e); app.exit(1); });
