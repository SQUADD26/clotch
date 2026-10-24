// Requisiti «fatti ma mai provati» (#456), parte B: ricerca, filtri, Friday (Ferma tutto, Decisioni, Non disturbare), impostazioni.
// Renderer vero, finestra nascosta, main simulato (scene del disegno + canali che registrano le chiamate): niente comandi, file o rete reali.
// Ogni requisito stampa «REQ <id> ok» o «REQ <id> difetto: <cosa>» (+ DEFECT_OPEN, uscita 2): un difetto non si corregge qui.
const H = require('./aiuti-requisiti.cjs');
const { assert, run, wait, clicca, scrivi, tasto, testo, carica, caricaChat, caricaScena, attesa, fatte, rispondi, req, nuova, ora, esc, barra, riga, voce } = H;
const vai = async (id, mod) => { H.daScena(id, mod); await caricaScena(); };

H.avvia('requisiti-b', async () => {
  await req('B1', async () => {
    nuova(); await caricaChat();
    assert.equal(await run(() => [...document.querySelectorAll('.barra-laterale button.riga')].find((b) => b.textContent.includes('Cerca sessioni')).querySelector('.lato')?.textContent), '⌘K');
    await riga('Cerca sessioni'); await wait(() => !!document.querySelector('.finestra-ricerca input'));
    assert.equal(await run(() => document.activeElement === document.querySelector('.finestra-ricerca input')), true, 'la ricerca si apre col cursore nel campo');
    await tasto('.finestra-ricerca', { key: 'Escape' }); await wait(() => !document.querySelector('.finestra-ricerca'));
    await tasto('body', { key: 'k', code: 'KeyK', metaKey: true }); await wait(() => !!document.querySelector('.finestra-ricerca'));
    await tasto('body', { key: 'k', code: 'KeyK', metaKey: true }); await wait(() => !document.querySelector('.finestra-ricerca'));
  });

  const apriRicerca = async () => { await riga('Cerca sessioni'); await wait(() => !!document.querySelector('.finestra-ricerca input')); };
  await req('B2', async () => {
    nuova(); await caricaChat(); await apriRicerca();
    const scelto = () => run(() => document.querySelector('.risultato.scelta .testo')?.textContent);
    await wait(() => document.querySelectorAll('.risultato').length === 3);
    assert.deepEqual(await testo('.risultato .testi > .testo:first-child'), ['Beta due', 'Gamma tre', 'Alfa uno'], 'prima la più recente'); assert.equal(await scelto(), 'Beta due');
    const k = (key) => tasto('.finestra-ricerca', { key });
    await k('ArrowDown'); assert.equal(await scelto(), 'Gamma tre'); await k('ArrowUp'); await k('ArrowUp'); assert.equal(await scelto(), 'Alfa uno', 'dalla prima si torna all\'ultima');
    await k('ArrowDown'); assert.equal(await scelto(), 'Beta due'); await k('ArrowDown'); await k('Enter');
    await wait(() => !document.querySelector('.finestra-ricerca') && document.querySelector('.riga-sessione.scelta .testo')?.textContent === 'Gamma tre');
    await wait((t) => document.querySelector('.messaggio-roberto .bolla')?.textContent === t, 'Messaggio C tre');
    await apriRicerca(); await run(() => document.querySelector('.velo').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); await wait(() => !document.querySelector('.finestra-ricerca'));
  });

  await req('B9', async () => {
    nuova((s) => { s.elenco.sessioni[1].titolo = 'Beta copia'; });
    rispondi['sessioni:cerca'] = (t) => (t === 'copia' ? [{ id: 's3', nelTitolo: false, frammento: '…ha detto copia davvero…', t: ora - 86400000 }] : []);
    await caricaChat(); await apriRicerca(); await scrivi('.finestra-ricerca input', 'copia');
    await wait(() => /ha detto copia/.test(document.querySelector('.risultati').innerText));
    assert.deepEqual(await testo('.finestra-ricerca .titolo-gruppo, .finestra-ricerca .titolo-sezione .testo'), ['Azioni', 'Sessioni', 'Messaggi']);
    assert.deepEqual(await testo('.voce-azione .etichetta'), ['Copia link alla sessione', 'Copia cartella di lavoro', 'Copia ID sessione', 'Copia ultimo blocco di codice']);
    const r = await run(() => [...document.querySelectorAll('.risultato')].map((b) => [...b.querySelectorAll('.testo, .t-xs')].map((e) => e.textContent)));
    assert.equal(r.length, 2); assert.deepEqual([r[0][0], r[0][2], r[1]], ['Beta copia', 'Oggi', ['Gamma tre', '… ha detto copia davvero …', 'Ieri']]); assert.match(r[0][1], /^beta-app · Codex/);
    await clicca('.voce-azione', 'Copia ID sessione'); await wait(() => !document.querySelector('.finestra-ricerca')); assert.deepEqual(fatte('sessioni:azione'), [['s1', 'copia-id']]);
  });

  await req('B10', async () => {
    nuova(); await caricaChat(); await apriRicerca(); await scrivi('.finestra-ricerca input', '  zzzz  ');
    await wait(() => !!document.querySelector('.nessun-risultato'));
    assert.deepEqual(await testo('.nessun-risultato span'), ['Nessun risultato per «zzzz»', 'Prova con altre parole o togli un filtro.']);
    await scrivi('.finestra-ricerca input', 'alfa'); await wait(() => !document.querySelector('.nessun-risultato') && document.querySelectorAll('.risultato').length === 1);
    await scrivi('.finestra-ricerca input', 'qqq'); await wait(() => !!document.querySelector('.nessun-risultato'));
  });

  await req('B6', async () => {
    nuova(); await caricaChat(); await riga('beta-app');
    await riga('Filtra'); await voce('Aggiungi filtro'); await voce('Stato');
    assert.deepEqual(await testo('.menu-filtro [role=menuitemcheckbox] .etichetta'), ['In corso', 'In attesa di te', 'Ferma', 'Finita', 'Errore']);
    await scrivi('.menu-filtro input', 'att'); assert.deepEqual(await testo('.menu-filtro [role=menuitemcheckbox] .etichetta'), ['In attesa di te'], 'la ricerca nel menu restringe le opzioni');
    await scrivi('.menu-filtro input', ''); await voce('Finita'); await voce('In attesa di te'); await esc(); // la cartella con i risultati si apre da sola (UI-FILTRO-CARTELLA-CHIUSA corretto): nessun clic su «clotch»
    assert.equal(await run(() => [...document.querySelectorAll('.barra-laterale .riga')].find((r) => r.querySelector('.testo')?.textContent === 'clotch')?.getAttribute('aria-expanded')), 'true', 'la cartella con i risultati è aperta da sola');
    assert.deepEqual(await barra(), ['Beta due', 'Gamma tre']); assert.match(await run(() => document.querySelector('.pillola-filtro').innerText), /Stato:\s*Finita, In attesa/); assert.equal((await testo('.titolo-sezione .testo')).at(-1), '2 sessioni');
    await clicca('.pillola-filtro', 'Stato:Finita, In attesa'); await voce('Finita'); await esc(); assert.deepEqual(await barra(), ['Gamma tre']);
    await clicca('.pillola-filtro', 'Stato:In attesa'); await voce('Rimuovi filtro'); await wait(() => !document.querySelector('.pillola-filtro:not(.aggiungi)'));
    assert.deepEqual(await barra(), ['Beta due', 'Gamma tre', 'Alfa uno']);
  });

  await req('FR3', async () => {
    await vai('101-37879'); // registro con sessioni al lavoro; la scena parte senza dialogo
    const n = Object.values(H.scena.registro.chat).filter((c) => c.stato === 'lavora' && c.chat !== 'friday' && !c.fine && !c.fermata).length;
    await carica({ vista: 'clotch-ai' }); await wait(() => !!document.querySelector('.comandi-titolo'));
    await clicca('.comandi-titolo button', 'Ferma tutto'); await wait(() => !!document.querySelector('[role=dialog]'));
    assert.match(await run(() => document.querySelector('[role=dialog]').innerText), new RegExp(`Le ${n} sessioni al lavoro`));
    await clicca('[role=dialog] button', 'Annulla'); await wait(() => !document.querySelector('[role=dialog]')); assert.deepEqual(fatte('clotch-ai:comando'), []);
    rispondi['clotch-ai:comando'] = (c) => (c === 'ferma_tutto' ? { esito: 'ok', testo: '', nonFermate: ['c-lettura', 'm-clotch'] } : { esito: 'ok', testo: '' });
    await clicca('.comandi-titolo button', 'Ferma tutto'); await clicca('[role=dialog] button', 'Ferma tutto');
    await wait(() => /2 sessioni non si sono fermate/.test(document.querySelector('.area-avvisi').innerText));
    rispondi['clotch-ai:comando'] = () => ({ esito: 'ok', testo: '', nonFermate: [] }); H.azzera();
    await clicca('.area-avvisi button', 'Riprova'); await wait(() => /sessioni ferme/.test(document.querySelector('.area-avvisi').innerText));
    assert.deepEqual(fatte('clotch-ai:comando')[0], ['ferma_tutto', undefined]);
    await clicca('.area-avvisi button', 'Riprendi tutte'); await attesa(60); assert.deepEqual(fatte('clotch-ai:comando').at(-1), ['riprendi_tutto', undefined]);
    rispondi['clotch-ai:comando'] = () => ({ esito: 'errore', testo: 'clotch AI non risponde' });
    await clicca('.comandi-titolo button', 'Ferma tutto'); await clicca('[role=dialog] button', 'Ferma tutto'); await wait(() => /clotch AI non risponde/.test(document.querySelector('.area-avvisi').innerText));
  });

  await req('FR5', async () => {
    // il lettore offre «Annulla» solo con la ricevuta locale del motore (#454): la scena non ne ha, qui la decisione ce l'ha
    await vai('101-39266', (s) => { s.registro.decisioni.find((d) => d.cosa.includes('0042')).annullabile = true; });
    assert.ok((await testo('.titolo-gruppo')).length >= 1);
    assert.match(await run(() => document.querySelector('.vista-clotch-ai').innerText), /Già su main: non si annulla/);
    const annullabili = await run(() => [...document.querySelectorAll('.voce-f')].filter((v) => v.querySelector('button')).map((v) => v.querySelector('.t-sm').textContent));
    assert.ok(annullabili.includes('Consentita la migrazione 0042 su dev'), annullabili.join('|'));
    const apriConferma = (cosa) => run((cosa) => [...document.querySelectorAll('.voce-f')].find((v) => v.textContent.includes(cosa)).querySelector('button').click(), cosa);
    await apriConferma('migrazione 0042'); await wait(() => !!document.querySelector('[role=dialog]'));
    assert.match(await run(() => document.querySelector('[role=dialog]').innerText), /migrazione inversa/);
    await clicca('[role=dialog] button', 'Lascia così'); await wait(() => !document.querySelector('[role=dialog]')); assert.deepEqual(fatte('clotch-ai:comando'), []);
    rispondi['clotch-ai:comando'] = () => ({ esito: 'errore', testo: 'Migrazione inversa non riuscita: niente è cambiato.' });
    await apriConferma('migrazione 0042'); await clicca('[role=dialog] button', 'Annulla la decisione');
    await wait(() => /Migrazione inversa non riuscita/.test(document.querySelector('.area-avvisi')?.innerText || '')); assert.deepEqual(fatte('clotch-ai:comando'), [['annulla', { decisione: H.scena.registro.decisioni.find((d) => d.cosa.includes('0042')).id }]]);
    rispondi['clotch-ai:comando'] = () => ({ esito: 'ok', testo: 'Decisione annullata. La sessione aspetta te.' });
    await clicca('.area-avvisi button', 'Riprova'); await wait(() => /Decisione annullata/.test(document.querySelector('.area-avvisi').innerText));
    assert.equal(fatte('clotch-ai:comando').length, 2);
  });

  await req('CL10', async () => {
    await vai('101-50008'); // con Clotch acceso
    await carica({ vista: 'clotch-ai' }); await wait(() => !!document.querySelector('.comandi-titolo'));
    await clicca('.comandi-titolo button', 'Non disturbare'); await wait(() => !!document.querySelector('.comandi-titolo .menu'));
    assert.deepEqual(await testo('.comandi-titolo .menu .voce .etichetta'), ['Per 1 ora', 'Fino alle 18:00', 'Fino a domani mattina', 'Finché non lo tolgo']);
    assert.match(await run(() => document.querySelector('.nota-menu').textContent), /Vale anche per clotch: niente voce né microfono/);
    await clicca('.comandi-titolo .menu .voce', 'Per 1 ora'); await wait(() => !document.querySelector('.comandi-titolo .menu'));
    assert.deepEqual(fatte('clotch-ai:comando'), [['non_disturbare', { acceso: true, minuti: 60 }]]);
    await vai('101-50071'); await carica({ vista: 'clotch-ai' }); await wait(() => !!document.querySelector('.comandi-titolo'));
    await clicca('.comandi-titolo button', 'Non disturbare'); await wait(() => !!document.querySelector('.nota-menu'));
    assert.match(await run(() => document.querySelector('.nota-menu').textContent), /continua a lavorare/);
    await clicca('.comandi-titolo .menu .voce', 'Finché non lo tolgo'); await attesa(50); assert.deepEqual(fatte('clotch-ai:comando').at(-1), ['non_disturbare', { acceso: true, fino: null }]);
  });

  const imp = (id, sezione, mod) => vai(id, mod);
  const etichette = (sel) => run((sel) => [...document.querySelectorAll(sel)].map((e) => e.getAttribute('aria-label')), sel);
  const imposta = () => fatte('sessioni:imposta-impostazioni').map((x) => x[0]);

  await req('H31', async () => {
    await imp('101-17193');
    const sw = () => run(() => document.querySelector('button[role=switch][aria-label="Mostra nella barra dei menu"]').getAttribute('aria-checked'));
    assert.equal(await sw(), 'true'); await clicca('button[role=switch]', 'Mostra nella barra dei menu'); await wait(() => document.querySelector('button[role=switch][aria-label="Mostra nella barra dei menu"]').getAttribute('aria-checked') === 'false');
    assert.deepEqual(imposta(), [{ barraDeiMenu: false }]);
    rispondi['sessioni:imposta-impostazioni'] = () => { throw new Error('disco pieno'); };
    await clicca('button[role=switch]', 'Mostra nella barra dei menu'); await wait(() => /disco pieno/.test(document.querySelector('.area-avvisi')?.innerText || ''));
    await wait(() => document.querySelector('button[role=switch][aria-label="Mostra nella barra dei menu"]').getAttribute('aria-checked') === 'false'); // non salvato: resta com'era
    delete rispondi['sessioni:imposta-impostazioni']; await clicca('.area-avvisi button', 'Riprova'); await wait(() => document.querySelector('button[role=switch][aria-label="Mostra nella barra dei menu"]').getAttribute('aria-checked') === 'true');
    await clicca('button[role=switch]', 'Apri all’avvio del Mac'); await attesa(80); assert.deepEqual(fatte('impostazioni:avvio'), [[false]]);
  }, { consenti: /disco pieno|Error occurred in handler/ });

  await req('H32', async () => {
    await imp('101-17193');
    await clicca('.scelta .valore', 'Lingua: Italiano'); await wait(() => !!document.querySelector('.scelta .menu'));
    assert.deepEqual(await run(() => [...document.querySelectorAll('.scelta .menu [role=menuitemradio]')].map((b) => [b.textContent.trim(), b.getAttribute('aria-checked')])), [['Rilevamento automatico', 'false'], ['Italiano', 'true'], ['English', 'false']]);
    await tasto('.scelta .menu', { key: 'ArrowDown' }); assert.equal(await run(() => document.activeElement.textContent.trim()), 'English');
    await esc(); await wait(() => !document.querySelector('.scelta .menu')); assert.deepEqual(imposta(), []);
    await clicca('.scelta .valore', 'Modello per i tuoi messaggi: Opus 5.5'); await wait(() => !!document.querySelector('.scelta .menu'));
    assert.match(await run(() => document.querySelector('.scelta .menu').innerText), /Opus 5\.5\s*Il più capace/);
    await clicca('.scelta .menu .voce .etichetta', 'Sonnet 5.5'); await wait(() => !document.querySelector('.scelta .menu'));
    assert.deepEqual(imposta(), [{ modello: 'Sonnet 5.5' }]); assert.ok((await etichette('.scelta .valore')).includes('Modello per i tuoi messaggi: Sonnet 5.5'));
  });

  await req('H6', async () => {
    await imp('101-31738');
    assert.deepEqual(await etichette('.scelta .valore'), ['Colore principale: Arancione', 'Carattere: Sistema', 'Dimensione del testo: Media', 'Densità dell’elenco: Normale']);
    await clicca('.scelta .valore', 'Colore principale: Arancione'); await wait(() => !!document.querySelector('.scelta .menu'));
    assert.deepEqual(await run(() => [...document.querySelectorAll('.scelta .menu .etichetta')].map((e) => e.textContent)), ['Arancione', 'Blu', 'Verde', 'Viola', 'Argento']);
    await clicca('.scelta .menu .voce .etichetta', 'Blu'); await wait(() => document.documentElement.dataset.colore === 'blu');
    await clicca('.scelta .valore', 'Densità dell’elenco: Normale'); await clicca('.scelta .menu .voce .etichetta', 'Compatta'); await wait(() => document.documentElement.dataset.densita === 'compatta');
    await clicca('button[role=switch]', 'Icone delle sessioni'); await attesa(60);
    assert.deepEqual(imposta(), [{ colore: 'Blu' }, { densita: 'Compatta' }, { iconeSessioni: false }]);
    await caricaScena(); assert.ok((await etichette('.scelta .valore')).includes('Colore principale: Blu'), 'dopo il riavvio il colore è quello salvato');
    await wait(() => document.documentElement.dataset.colore === 'blu' && document.documentElement.dataset.densita === 'compatta');
  });

  await req('H7', async () => {
    await imp('101-10369');
    const righe = () => run(() => [...document.querySelectorAll('.riga.azione .t-sm:first-child')].map((e) => e.textContent));
    await wait(() => document.querySelectorAll('.riga.azione').length === 5); assert.equal((await righe())[0], '~/.claude-accountmanager');
    assert.equal(await run(() => document.querySelector('.riga.azione .errore')?.textContent), 'Non leggibile: permesso negato', 'la cartella non leggibile mostra il suo errore');
    await run(() => [...document.querySelectorAll('.riga.azione')].find((r) => r.textContent.includes('.claude-squadd')).querySelector('button').click());
    await clicca('[role=dialog] button', 'Rimuovi'); // «Rimuovi» chiede conferma (101-22095)
    await wait(() => document.querySelectorAll('.riga.azione').length === 4); assert.deepEqual(imposta(), [{ accountTolti: ['~/.claude-squadd'] }]);
    await wait(() => /Cartella rimossa/.test(document.querySelector('.area-avvisi').innerText)); await clicca('.area-avvisi button', 'Annulla');
    await wait(() => document.querySelectorAll('.riga.azione').length === 5); assert.deepEqual(imposta().at(-1), { accountTolti: [] });
    rispondi['impostazioni:scegli-cartella'] = () => '~/.claude-nuovo'; rispondi['impostazioni:cartelle'] = (p) => p.map((x) => ({ percorso: x, dettaglio: '0 sessioni · letta ora', errore: false }));
    await clicca('button', 'Aggiungi cartella'); await wait(() => document.querySelectorAll('.riga.azione').length === 6);
    assert.deepEqual(imposta().at(-1), { accountAggiunti: ['~/.claude-nuovo'] }); assert.ok((await righe()).includes('~/.claude-nuovo'));
  });

  await req('H16', async () => {
    await imp('101-17716');
    assert.equal((await testo('.gruppo .riga .t-base')).length, 11); // con «Trova nella sessione» (⌘F)
    const tasti = () => run(() => Object.fromEntries([...document.querySelectorAll('.gruppo .riga')].map((r) => [r.querySelector('.t-base').textContent, r.querySelector('.tasto, .secondario')?.textContent])));
    assert.equal((await tasti())['Cerca sessioni'], '⌘K');
    const premi = (key, code, extra = {}) => run((key, code, extra) => window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...extra })), key, code, extra);
    await clicca('button', 'Cambia Cerca sessioni'); await wait(() => document.querySelector('.in-ascolto')?.textContent === 'Premi i tasti…');
    await premi('Escape', 'Escape'); await wait(() => !document.querySelector('.in-ascolto')); assert.deepEqual(imposta(), []);
    await clicca('button', 'Cambia Cerca sessioni'); await premi('l', 'KeyL', { metaKey: true }); await attesa(80);
    assert.deepEqual(imposta(), [{ scorciatoie: { ...require('../dist/src/partenza.js').PARTENZA.scorciatoie, cerca: '⌘L' } }]);
    await clicca('button', 'Cambia Nega'); await premi('j', 'KeyJ', { metaKey: true }); await wait(() => /Già usata da «Prossima sessione in attesa»/.test(document.body.innerText));
    await clicca('button', 'Sostituisci'); await attesa(80);
    const ultimo = imposta().at(-1).scorciatoie; assert.deepEqual([ultimo.nega, ultimo.prossima], ['⌘J', null]);
    await wait(() => document.body.innerText.includes('Non assegnata')); assert.ok((await etichette('button')).includes('Assegna Prossima sessione in attesa'));
  });

  await req('H18', async () => {
    await imp('101-17893');
    assert.match(await run(() => document.body.innerText), /2 cartelle/);
    await clicca('button[role=switch]', 'Nascondi chiavi e token'); await attesa(60); assert.deepEqual(imposta(), [{ nascondiChiavi: false }]);
    await clicca('.scelta .valore', 'Cronologia: 30 giorni'); await clicca('.scelta .menu .voce .etichetta', '90 giorni'); await attesa(60); assert.deepEqual(imposta().at(-1), { cronologia: '90 giorni' });
    await clicca('button', 'Elimina dati…'); await wait(() => !!document.querySelector('[role=dialog]'));
    await clicca('[role=dialog] button', 'Annulla'); await wait(() => !document.querySelector('[role=dialog]')); assert.deepEqual(fatte('impostazioni:elimina-dati'), []);
    await clicca('button', 'Elimina dati…'); await esc(); await wait(() => !document.querySelector('[role=dialog]')); assert.deepEqual(fatte('impostazioni:elimina-dati'), []);
    await clicca('button', 'Elimina dati…'); await clicca('[role=dialog] button', 'Elimina dati'); await attesa(80); assert.deepEqual(fatte('impostazioni:elimina-dati'), [[]]);
  });

  await req('H36', async () => {
    await imp('101-17893');
    await run(() => document.querySelector('.valore-scelta').click()); await wait(() => document.querySelector('h1')?.textContent === 'Cartelle escluse');
    assert.deepEqual(await testo('.riga.azione .t-base'), ['~/Repos/vecchi', '~/Downloads']);
    await clicca('.riga.azione button', 'Rimuovi'); await wait(() => document.querySelectorAll('.riga.azione').length === 1); assert.deepEqual(imposta(), [{ cartelleEscluse: ['~/Downloads'] }]);
    await clicca('.indietro', 'Dati'); await wait(() => document.querySelector('h1')?.textContent === 'Dati'); assert.match(await run(() => document.body.innerText), /1 cartella/);
  });

  await req('H12', async () => {
    await imp('101-32155');
    await wait(() => /Usati da clotch: 128 MB/.test(document.body.innerText));
    assert.deepEqual(await testo('.voce-legenda'), ['Indice', 'Cache dei messaggi', 'Immagini', 'Altro']);
    let sblocca; rispondi['sessioni:ricostruisci'] = () => new Promise((r) => { sblocca = r; });
    await clicca('button', 'Ricostruisci'); await wait(() => [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Ricostruisci' || b.textContent === 'Svuota').every((b) => b.disabled));
    const letture = fatte('sessioni:spazio').length; sblocca(); await wait(() => [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Svuota').every((b) => !b.disabled));
    await wait(() => true); await attesa(100); assert.equal(fatte('sessioni:spazio').length, letture + 1, 'lo spazio si rilegge dopo l\'operazione');
    rispondi['sessioni:svuota'] = () => { throw new Error('cache bloccata'); };
    await clicca('button', 'Svuota'); await wait(() => /cache bloccata/.test(document.querySelector('.area-avvisi')?.innerText || ''));
  }, { consenti: /cache bloccata|Error occurred in handler/ });

  await req('H39', async () => {
    let sblocca; rispondi['sessioni:spazio'] = () => new Promise((r) => { sblocca = () => r({ indice: 1e6, messaggi: 1e6, immagini: 1e6, altro: 1e6 }); });
    await imp('101-32155'); await wait(() => /Calcolo lo spazio delle immagini…/.test(document.body.innerText));
    assert.equal(await run(() => !!document.querySelector('.riga.calcolo svg.gira')), true, 'lo spinner gira');
    sblocca(); await wait(() => !/Calcolo lo spazio/.test(document.body.innerText) && /Usati da clotch: 4 MB/.test(document.body.innerText));
  });

  await req('F10', async () => {
    await imp('119-57404');
    await wait(() => document.querySelector('.scelta .valore')?.getAttribute('aria-label') === 'Versione: 0.1.0');
    await clicca('.scelta .valore', 'Versione: 0.1.0'); await wait(() => !!document.querySelector('.scelta .menu'));
    assert.deepEqual(await testo('.scelta .menu .etichetta'), ['Controlla aggiornamenti', 'Novità della versione 0.1.0', 'Copia versione']);
    await clicca('.scelta .menu .voce', 'Controlla aggiornamenti'); await attesa(60); assert.deepEqual(fatte('impostazioni:aggiornamenti').at(-1), [true]);
    await clicca('.scelta .valore', 'Versione: 0.1.0'); await clicca('.scelta .menu .voce', 'Novità della versione 0.1.0'); await wait(() => !!document.querySelector('[role=dialog]'));
    assert.equal((await testo('[role=dialog] .novita li')).length, 4); await clicca('[role=dialog] button', 'Chiudi'); await wait(() => !document.querySelector('[role=dialog]'));
    await clicca('button[role=switch]', 'Aggiornamenti automatici'); await attesa(60); assert.deepEqual(imposta(), [{ aggiornamentiAutomatici: false }]);
  });

  await req('H3', async () => {
    await imp('101-17363');
    const apri = async () => { await run(() => document.querySelector('.scelta [aria-label^="Silenzio"]').click()); await clicca('.scelta .menu .voce', 'Scegli le ore…'); await wait(() => !!document.querySelector('[role=dialog] input')); };
    await apri(); assert.match(await run(() => document.querySelector('[role=dialog]').innerText), /Scegli le ore[\s\S]*22:00–8:00/);
    await scrivi('[role=dialog] input', 'domani'); await clicca('[role=dialog] button', 'Salva'); await wait(() => /Ore non valide/.test(document.querySelector('.area-avvisi')?.innerText || ''));
    assert.deepEqual(imposta(), [], 'ore non valide: niente salvato');
    await apri(); await scrivi('[role=dialog] input', '21-6.30'); await clicca('[role=dialog] button', 'Salva'); await wait(() => !document.querySelector('[role=dialog]'));
    await attesa(60); assert.deepEqual(imposta(), [{ silenzio: '21:00–6:30' }]);
    await wait(() => !!document.querySelector('.scelta [aria-label="Silenzio: 21:00–6:30"]'));
  });

  await req('H37', async () => { // H17: la scheda Andamento disegna l'uso al giorno che il main manda
    await imp('119-57613');
    await wait(() => document.querySelectorAll('.tab-uso').length === 2 && document.querySelectorAll('.barra-uso').length === 4);
    assert.equal(await run(() => !document.querySelector('.andamento')), true, 'si parte da Panoramica');
    await clicca('.tab-uso', 'Andamento'); await wait(() => !!document.querySelector('.andamento'));
    const giorni = H.scena.uso[0].giorni.length;
    assert.equal(await run(() => document.querySelectorAll('.andamento .giorno').length), giorni);
    assert.deepEqual(await testo('.andamento .voce-legenda'), H.scena.uso.map((u) => u.account));
    assert.match(await run(() => document.querySelector('.andamento .testata').innerText), new RegExp(`Ultimi ${giorni} giorni`));
    await clicca('.tab-uso', 'Panoramica'); await wait(() => !document.querySelector('.andamento') && document.querySelectorAll('.barra-uso').length === 4);
  });
  // Collegamenti di clotch AI (#456, qa/456-clotch-ai): registro, «Fatto oggi», avvio all'apertura, «Scarica clotch» e interruttori.
  await req('FR1', async () => {
    await vai('101-36225'); // registro non leggibile
    await clicca('button', 'Apri il registro'); await attesa(80); assert.deepEqual(fatte('impostazioni:apri'), [['~/.claude/registro']]);
    rispondi['impostazioni:apri'] = () => { throw new Error('cartella assente'); };
    await clicca('button', 'Apri il registro'); await wait(() => /cartella assente/.test(document.querySelector('.area-avvisi')?.innerText || ''));
    await vai('101-35494');
    const elenco = () => run(() => document.querySelector('.vista-clotch-ai').innerText.includes('Notch: avviso schermo'));
    assert.equal(await elenco(), false, '«Fatto oggi» parte chiuso');
    await clicca('button', 'Fatto oggi: 4'); await wait(() => document.querySelector('button[aria-expanded=true]'));
    assert.equal(await elenco(), true, '«Fatto oggi» mostra le sessioni finite oggi');
    await clicca('button', 'Fatto oggi: 4'); assert.equal(await elenco(), false);
  }, { consenti: /cartella assente|Error occurred in handler/ });

  await req('FR7', async () => {
    const avvio = async (registro, attesi, nota) => {
      H.azzera(); rispondi['clotch-ai:avvia'] = () => ({ ok: true, testo: '' });
      H.daScena('101-42000', (s) => { delete s.registro.chat.friday; Object.assign(s.registro, registro); }); await caricaScena(); await attesa(250);
      assert.deepEqual(fatte('clotch-ai:avvia').length, attesi, nota);
    };
    await avvio({ clotchAi: null, impostazioni: { attiva: true } }, 1, 'impostazioni accese, nessun evento: parte una volta');
    assert.match(await run(() => document.body.innerText), /Avvio…/);
    await avvio({ clotchAi: null, impostazioni: { attiva: false } }, 0, 'impostazioni spente: non parte');
    await avvio({ clotchAi: { evento: 'stop', t: H.ora - 60000 }, impostazioni: { attiva: true } }, 0, 'spenta da Roberto: non parte');
    await avvio({ clotchAi: null, impostazioni: null }, 0, 'senza impostazioni: non parte');
  });

  await req('CL1', async () => {
    await vai('101-45993'); // Clotch assente
    await run(() => { window.__aperti = []; window.open = (u) => { __aperti.push(u); return null; }; });
    await clicca('button', 'Scarica clotch'); assert.deepEqual(await run(() => __aperti), ['https://github.com/SQUADD26/clotch/releases/latest']);
    await vai('101-45956'); await wait(() => !!document.querySelector('button[role=switch]'));
    for (const v of ['Voce dal notch', 'Dettatura dal notch', 'Avvisi nel notch', 'Obiettivi anche nel notch']) await clicca('button[role=switch]', v);
    await attesa(80); assert.deepEqual(imposta(), [{ clotchVoce: false }, { clotchDettatura: false }, { clotchAvvisi: false }, { clotchObiettivi: false }]);
    // effetto: obiettivo proposto con Clotch acceso, nota «anche dal notch» solo con l'interruttore acceso
    const nota = () => run(() => /decidere anche dal notch/.test(document.body.innerText));
    for (const acceso of [true, false]) { await vai('101-47170', (s) => { s.impostazioni = { clotchObiettivi: acceso }; }); await wait(() => /Obiettivo proposto/.test(document.body.innerText)); assert.equal(await nota(), acceso); }
    // effetto: avviso detto da Clotch, toast «anche al notch» solo con l'interruttore acceso
    for (const acceso of [true, false]) {
      await vai('101-35494', (s) => { s.impostazioni = { clotchAvvisi: acceso }; }); await attesa(150);
      H.win.webContents.send('clotch-ai:registro', { ...H.scena.registro, avvisi: [{ id: 'n1', t: H.ora, testo: 'x', livello: 'normale', motivo: 'chiesto', dettoDa: 'clotch', sessioni: [] }] }); await attesa(200);
      assert.equal(await run(() => /Avviso mandato anche al notch/.test(document.querySelector('.area-avvisi')?.innerText || '')), acceso);
    }
  });

});
