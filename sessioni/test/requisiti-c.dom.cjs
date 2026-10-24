// Requisiti «fatti ma mai provati» (#456), parte C: i collegamenti chiusi dai rami qa/456 (profilo, menu dell'app, Leggi con clotch AI, PR e prove,
// Andamento, Scegli le ore, collegamenti di clotch AI, Ripristina). Renderer vero, finestra nascosta, main simulato: nessun comando, file o rete reali.
// Ogni requisito stampa «REQ <id> ok» o «REQ <id> difetto: <cosa>» (+ DEFECT_OPEN, uscita 2): un difetto non si corregge qui.
const H = require('./aiuti-requisiti.cjs');
const { assert, run, wait, clicca, scrivi, tasto, testo, carica, caricaChat, caricaScena, attesa, fatte, rispondi, req, nuova, U, AS, PE, ora, aggiorna, esc, barra, riga, voce } = H;
const vai = async (id, mod) => { H.daScena(id, mod); await caricaScena(); };

const imp = (id, sezione, mod) => vai(id, mod);
const imposta = () => fatte('sessioni:imposta-impostazioni').map((x) => x[0]);

H.avvia('requisiti-c', async () => {
  await req('A16', async () => { // nome e iniziali dal profilo vero (account Claude o macOS), non scritti nel codice; «Info su clotch» apre Info
    nuova(); rispondi['impostazioni:profilo'] = () => ({ nome: 'Anna Verdi', iniziali: 'AV' }); await caricaChat();
    await wait(() => document.querySelector('.piede .avatar')?.textContent === 'AV');
    assert.equal((await testo('.piede .testi span'))[0], 'Anna Verdi');
    await run(() => document.querySelector('.piede .avatar').click()); await wait(() => !!document.querySelector('[role=menu] .testata'));
    assert.equal((await testo('[role=menu] .testata .medio'))[0], 'Anna Verdi');
    await clicca('[role=menu] .voce', 'Info su clotch'); await wait(() => document.querySelector('.nav-impostazioni .voce.scelta')?.textContent === 'Info');
  });

  await req('A27', async () => { // il menu dell'app macOS: «Informazioni su clotch» e le voci standard
    const { menuApp } = require(H.root + '/dist/src/branding.js');
    const m = menuApp(), app = m[0].submenu.map((v) => v.label || v.type);
    assert.equal(m[0].label, 'clotch');
    assert.deepEqual(m[0].submenu.map((v) => v.role).filter(Boolean), ['about', 'services', 'hide', 'hideOthers', 'unhide', 'quit']);
    assert.equal(app[0], 'Informazioni su clotch'); assert.equal(app.at(-1), 'Esci da clotch');
    assert.deepEqual(m.slice(1).map((v) => v.role), ['fileMenu', 'editMenu', 'viewMenu', 'windowMenu']);
  });


  await req('D2', async () => { // «Leggi con clotch AI»: bottone e voce del menu mandano il testo della risposta (senza Markdown) alla voce
    nuova((s) => { s.messaggi.s1 = [U('domanda'), AS('## Titolo\n**grassetto** e `codice`', 1000)]; s.elenco.sessioni[0].stato = 'finita'; }); await caricaChat();
    await wait(() => !!document.querySelector('.risposta .azioni'));
    assert.equal(await run(() => document.querySelector('.risposta .azioni button[aria-label="Leggi con clotch AI"]').disabled), false);
    H.azzera(); await clicca('.risposta .azioni button', 'Leggi con clotch AI'); await attesa(50);
    assert.deepEqual(fatte('clotch-ai:comando'), [['voce_leggi', { testo: 'Titolo\n\ngrassetto e codice' }]]);
    H.azzera(); await clicca('.risposta .azioni button', 'Altro'); await clicca('.risposta .menu .voce', 'Leggi con clotch AI'); await attesa(50);
    assert.deepEqual(fatte('clotch-ai:comando'), [['voce_leggi', { testo: 'Titolo\n\ngrassetto e codice' }]]);
  });

  await req('C7', async () => { // prova «fallita» dal registro; tutte le PR (con stato o solo col link), non solo l'ultima
    const pr = (n, stato, verso) => ({ numero: n, url: `https://example.test/pull/${n}`, stato, verso });
    nuova((s) => {
      s.elenco.sessioni[0].obiettivo = { testo: 'Obiettivo di prova', stato: 'aperto', valido: true, prove: [{ testo: 'Prova verde', fatta: true }, { testo: 'Prova rossa', fatta: false, fallita: true }, { testo: 'Prova da fare', fatta: false }] };
      s.info = { s1: { contesto: 1000, file: { quanti: 0, aggiunte: 0, tolte: 0 }, prs: [pr(1, 'unita', 'dev'), pr(2, null, null), pr(3, 'aperta', 'dev')] } };
    });
    await caricaChat(); await clicca('button', 'Pannello'); await wait(() => document.querySelectorAll('.pannello-info .scheda').length > 0);
    assert.equal(await run(() => document.querySelector('.pannello-obiettivo .prova:nth-child(3) span.errore')?.textContent), 'Prova rossa', 'la prova fallita ha il suo stato');
    assert.equal(await run(() => document.querySelectorAll('.pannello-obiettivo .prova span.errore').length), 1, 'solo quella fallita');
    await wait(() => document.querySelectorAll('.apri-pr').length === 3);
    assert.deepEqual((await testo('.scheda .riga-info .testo')).filter((t) => t.startsWith('PR #')), ['PR #1 · unita in dev', 'PR #2', 'PR #3 · aperta verso dev']);
    assert.deepEqual(await run(() => [...document.querySelectorAll('.apri-pr')].map((a) => a.getAttribute('href'))), [1, 2, 3].map((n) => `https://example.test/pull/${n}`));
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

  await req('B7', async () => { // anche H8: Ripristina vivo, rifiuto del motore vecchio leggibile
    await vai('101-32359'); await wait(() => document.body.textContent.includes('Backup Hetzner'));
    const ripr = () => run(() => [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Ripristina').map((b) => b.disabled));
    assert.deepEqual(await ripr(), [false, false, false], 'Ripristina è acceso');
    await scrivi('input[placeholder="Cerca sessioni archiviate"]', 'Backup'); await attesa(60);
    assert.equal((await ripr()).length, 1, 'la ricerca filtra');
    rispondi['clotch-ai:comando'] = () => ({ esito: 'rifiutato', testo: "comando sconosciuto: 'ripristina'" });
    await clicca('button', 'Ripristina'); await wait(() => /Ripristino non disponibile/.test(document.querySelector('.area-avvisi')?.textContent ?? ''));
    assert.match(await run(() => document.querySelector('.area-avvisi').textContent), /aggiorna clotch AI/);
    assert.equal((await ripr()).length, 1, 'la riga resta');
    rispondi['clotch-ai:comando'] = () => ({ esito: 'ok', testo: '' });
    await clicca('button', 'Ripristina'); await attesa(80);
    assert.deepEqual(fatte('clotch-ai:comando').at(-1), ['ripristina', { chat: 'a3' }]); assert.equal((await ripr()).length, 0, 'ripristinata: esce dall\'elenco');
    delete rispondi['clotch-ai:comando'];
  });

});
