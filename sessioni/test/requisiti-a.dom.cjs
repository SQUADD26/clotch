// Requisiti «fatti ma mai provati» (#456), parte A: chat, casella, intestazione, barra del titolo, righe dell'elenco. Renderer vero,
// finestra nascosta, main simulato (scene del disegno + canali che registrano le chiamate): nessun comando, file o rete reali.
// Ogni requisito stampa «REQ <id> ok» o «REQ <id> difetto: <cosa>» (+ DEFECT_OPEN, uscita 2): un difetto non si corregge qui.
const H = require('./aiuti-requisiti.cjs');
const { assert, run, wait, clicca, scrivi, tasto, testo, carica, caricaChat, attesa, fatte, rispondi, req, nuova, U, AS, PE, ora, aggiorna, esc, barra, riga, voce } = H;
const { NON_RISPONDE_MS } = require(H.root + '/dist/src/clotch-ai.js'); // la soglia del motore (20 min), non una copia a mano
const copiaFinta =() => run(() => { window.__copiato = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiato.push(t); } }, configurable: true }); });

H.avvia('requisiti-a', async () => {
  await req('A1', async () => {
    nuova(); await caricaChat();
    const m = await run(() => { const b = document.querySelector('.barra-titolo'), q = (a) => document.querySelector(`button[aria-label="${a}"]`);
      return { h: b.getBoundingClientRect().height, drag: getComputedStyle(b).getPropertyValue('-webkit-app-region'), i: q('Indietro').disabled, a: q('Avanti').disabled, barra: !!q('Barra laterale'), att: !!q('Attività') }; });
    assert.deepEqual(m, { h: 44, drag: 'drag', i: true, a: true, barra: true, att: true });
    await clicca('.barra-laterale .riga .testo', 'beta-app'); await clicca('.riga-sessione .testo', 'Beta due'); await wait(() => !document.querySelector('button[aria-label="Indietro"]').disabled);
    await clicca('button', 'Indietro'); await wait(() => document.querySelector('.riga-sessione.scelta .testo')?.textContent === 'Alfa uno');
  });

  await req('A5', async () => {
    nuova((s) => { const c = s.registro.chat.s1; c.stato = 'serve_roberto'; c.richieste = [{ rid: 'r1', genere: 'permesso', strumento: 'Bash', ingresso: { command: 'ls' }, domande: [] }];
      s.registro.chat.c2 = { ...c, chat: 'c2', titolo: 'Seconda', richieste: [] }; });
    await caricaChat(); await wait(() => document.querySelector('.bottone-attivita .contatore')?.textContent === '2');
    await clicca('button', 'Mostra attività'); await wait(() => !!document.querySelector('[role=dialog][aria-label="Attività"]'));
    await tasto('body', { key: 'Escape' }); await wait(() => !document.querySelector('.popover-attivita'));
    await clicca('button', 'Mostra attività'); await clicca('.popover-attivita button', 'Chiudi'); await wait(() => !document.querySelector('.popover-attivita'));
  });

  await req('A25', async () => {
    nuova(); await caricaChat();
    const r = await run(() => { const col = (v) => { const e = document.createElement('i'); e.style.color = `var(--${v})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
      const bg = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
      return { cornice: [bg('.cornice'), col('colore-fondo-cornice')], superficie: [bg('.superficie'), col('colore-fondo-superficie')], testo: [getComputedStyle(document.querySelector('.messaggio-roberto .bolla')).color, col('colore-testo-primario')], scuro: bg('.superficie').match(/\d+/g).slice(0, 3).every((n) => n < 60) }; });
    assert.deepEqual(r.cornice[0], r.cornice[1]); assert.deepEqual(r.superficie[0], r.superficie[1]); assert.equal(r.scuro, true, 'la superficie è scura');
    assert.notEqual(r.testo[0], r.superficie[0], 'testo e fondo non coincidono');
  });

  await req('C1', async () => {
    nuova(); await caricaChat();
    const dati = () => run(() => ({ titolo: document.querySelector('.intestazione .titolo')?.textContent, stato: document.querySelector('.intestazione .stato')?.textContent, dati: document.querySelector('.intestazione .dati')?.textContent }));
    let d = await dati(); assert.equal(d.titolo, 'Alfa uno'); assert.match(d.stato, /In corso/);
    for (const x of ['clotch', 'feat/333-sessioni-lettura', 'Opus 5.5', 'Claude Code']) assert.ok(d.dati.includes(x), 'manca ' + x + ' in ' + d.dati);
    await clicca('.riga-sessione .testo', 'Gamma tre'); await wait(() => /In attesa di te/.test(document.querySelector('.intestazione .stato')?.textContent));
    await clicca('.barra-laterale .riga .testo', 'beta-app'); await clicca('.riga-sessione .testo', 'Beta due'); await wait(() => /Finita/.test(document.querySelector('.intestazione .stato')?.textContent));
    d = await dati(); assert.equal(d.titolo, 'Beta due'); assert.ok(d.dati.includes('Codex') && d.dati.includes('beta-app'), d.dati);
    assert.equal(await run(() => !!document.querySelector('.pannello')), true);
    // il bottone gira: obiettivo -> Info sessione (schede, bottone premuto) -> chiuso (#437)
    await clicca('button', 'Mostra pannello'); await wait(() => document.querySelector('button[aria-label="Mostra pannello"]')?.getAttribute('aria-expanded') === 'true' && !!document.querySelector('.pannello'));
    await clicca('button', 'Mostra pannello'); await wait(() => !document.querySelector('.pannello'));
    await clicca('button', 'Mostra pannello'); await wait(() => !!document.querySelector('.pannello'));
  });

  await req('D1', async () => {
    const lungo = 'x'.repeat(400), segreto = 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    nuova((s) => { s.messaggi.s1 = [U(`riga uno\nriga <b>due</b> ${lungo}`), U(`la chiave ${segreto} resta qui`)]; }); await caricaChat();
    const r = await run(() => { const b = [...document.querySelectorAll('.messaggio-roberto .bolla')]; return { t: b.map((e) => e.textContent), html: b[0].innerHTML, ws: getComputedStyle(b[0]).whiteSpace, ov: b[0].scrollWidth - b[0].clientWidth, cont: b[0].parentElement.clientWidth - b[0].clientWidth }; });
    assert.equal(r.t[0], `riga uno\nriga <b>due</b> ${lungo}`); assert.ok(!/<b>/.test(r.html), 'il codice HTML nel testo non diventa elemento');
    assert.match(r.ws, /pre/, 'a capo del testo conservati'); assert.ok(r.ov <= 1, 'la parola lunga va a capo dentro la bolla: scarto ' + r.ov);
    assert.ok(!r.t[1].includes('ABCDEFGHIJ') && r.t[1].includes('••••'), 'la chiave è coperta: ' + r.t[1]);
  });

  await req('E1', async () => {
    nuova(); await caricaChat('s2');
    const st = () => run(() => ({ c: document.querySelector('.casella').className, off: document.querySelector('.bottone-invia').disabled, a: document.querySelector('.bottone-invia').getAttribute('aria-label'), ph: document.querySelector('textarea').placeholder }));
    let s = await st(); assert.deepEqual([/vuota/.test(s.c), s.off, s.a, s.ph], [true, true, 'Invia', 'Chiedi alla sessione']);
    await scrivi('textarea', 'ciao'); s = await st(); assert.deepEqual([/scritta/.test(s.c), s.off], [true, false]);
    await scrivi('textarea', '   '); s = await st(); assert.deepEqual([s.off], [true], 'solo spazi: invio spento');
    await scrivi('textarea', ''); s = await st(); assert.ok(/vuota/.test(s.c));
  });

  await req('E2', async () => {
    nuova(); await caricaChat('s2');
    const bordo = () => run(() => { const col = (v) => { const e = document.createElement('i'); e.style.borderColor = `var(--${v})`; document.body.append(e); const c = getComputedStyle(e).borderTopColor; e.remove(); return c; };
      return [getComputedStyle(document.querySelector('.casella')).borderTopColor, col('colore-bordo-fuoco'), col('colore-bordo-normale')]; });
    let [b, fuoco, norm] = await bordo(); assert.equal(b, norm, 'a riposo il bordo è normale');
    await run(() => document.querySelector('textarea').focus()); [b, fuoco, norm] = await bordo(); assert.equal(b, fuoco, 'a fuoco il bordo è quello di fuoco');
    await run(() => document.querySelector('textarea').blur()); [b, fuoco, norm] = await bordo(); assert.equal(b, norm, 'tolto il fuoco torna normale');
  });

  await req('E4', async () => {
    nuova(); await caricaChat();
    const st = () => run(() => { const e = document.createElement('i'); e.style.background = 'var(--colore-fondo-accento)'; document.body.append(e); const acc = getComputedStyle(e).backgroundColor; e.remove();
      const b = document.querySelector('.bottone-invia'); return { c: document.querySelector('.casella').className, a: b.getAttribute('aria-label'), bg: getComputedStyle(b).backgroundColor, acc, off: b.disabled }; });
    let s = await st(); assert.deepEqual([/in-corso/.test(s.c), s.a, s.bg, s.off], [true, 'Interrompi', s.acc, false]);
    await run(() => document.querySelector('.bottone-invia').click()); await attesa(60);
    assert.deepEqual(fatte('clotch-ai:comando'), [['interrompi', { chat: 's1' }]]);
    await scrivi('textarea', 'altro'); s = await st(); assert.equal(s.a, 'Invia', 'con del testo il bottone torna Invia');
  });

  await req('E5', async () => {
    nuova((s) => { s.elenco.sessioni[1].sorgente = 'cursor'; }); await caricaChat('s2');
    const r = await run(() => { const t = document.querySelector('textarea'); return { d: t.disabled, ph: t.placeholder, c: document.querySelector('.casella').className, off: document.querySelector('.bottone-invia').disabled }; });
    assert.deepEqual([r.d, r.ph, /disabilitata/.test(r.c), r.off], [true, 'Rispondi da Cursor', true, true]);
    await run(() => document.querySelector('.bottone-invia').click()); await attesa(40); assert.deepEqual(fatte('clotch-ai:comando'), []);
  });

  await req('E15', async () => {
    nuova(); await caricaChat('s2');
    const alt = () => run(() => ({ h: document.querySelector('textarea').getBoundingClientRect().height, giu: document.querySelector('.casella').getBoundingClientRect().bottom, fin: innerHeight }));
    const h0 = (await alt()).h;
    await scrivi('textarea', Array.from({ length: 6 }, (_, i) => 'riga ' + i).join('\n')); const h6 = (await alt()).h;
    assert.ok(h6 > h0 * 4, `la casella cresce con le righe: ${h0} -> ${h6}`);
    await scrivi('textarea', Array.from({ length: 120 }, (_, i) => 'riga ' + i).join('\n')); const m = await alt();
    assert.ok(m.giu <= m.fin, `con 120 righe la casella resta nella finestra (fondo ${m.giu} su ${m.fin})`);
    await scrivi('textarea', ''); assert.equal((await alt()).h, h0, 'svuotata torna a una riga');
  });

  await req('R4', async () => {
    nuova((s) => { s.registro.chat.s1.coda = [{ voce: 'v1', testo: 'prima in coda' }, { voce: 'v2', testo: 'seconda in coda' }]; }); await caricaChat();
    await wait(() => document.querySelectorAll('.messaggio-in-coda').length === 2);
    assert.equal((await testo('.messaggio-in-coda .etichetta'))[0], '2 messaggi in coda');
    await clicca('.messaggio-in-coda button', 'Rimuovi'); await attesa(50);
    assert.deepEqual(fatte('clotch-ai:comando').at(-1), ['coda_togli', { chat: 's1', voce: 'v1' }]);
    await clicca('.messaggio-in-coda button', 'Interrompi e manda ora'); await attesa(80);
    assert.deepEqual(fatte('clotch-ai:comando').slice(-2), [['manda', { chat: 's1', testo: 'prima in coda', modo: 'subito' }], ['coda_togli', { chat: 's1', voce: 'v1' }]]);
    await clicca('.messaggio-in-coda button', 'Modifica'); await wait(() => document.querySelector('textarea').value === 'prima in coda' && !!document.querySelector('.nota-casella'));
    await scrivi('textarea', 'nuovo testo'); H.azzera();
    await tasto('textarea', { key: 'Enter', code: 'Enter', metaKey: true }); await attesa(80);
    assert.deepEqual(fatte('clotch-ai:comando'), [['coda_modifica', { chat: 's1', voce: 'v1', testo: 'nuovo testo' }]]);
    await scrivi('textarea', 'subito'); await tasto('textarea', { key: 'Enter', code: 'Enter' }); await attesa(80);
    assert.deepEqual(fatte('clotch-ai:comando').at(-1), ['manda', { chat: 's1', testo: 'subito', modo: 'subito' }]);
    await scrivi('textarea', 'in coda'); await tasto('textarea', { key: 'Enter', code: 'Enter', metaKey: true }); await attesa(80);
    assert.deepEqual(fatte('clotch-ai:comando').at(-1), ['manda', { chat: 's1', testo: 'in coda', modo: 'coda' }]);
  });

  await req('D7', async () => {
    const md = '## Titolo\n**grassetto** e `codice`';
    nuova((s) => { s.messaggi.s1 = [U('domanda'), AS(md, 1000)]; s.elenco.sessioni[0].stato = 'finita'; }); await caricaChat(); await copiaFinta();
    await wait(() => !!document.querySelector('.risposta .azioni'));
    await clicca('.risposta .azioni button', 'Altre azioni'); await wait(() => !!document.querySelector('.pezzo-chat .menu'));
    assert.deepEqual(await testo('.pezzo-chat .menu .etichetta'), ['Copia testo', 'Copia come Markdown', 'Leggi con clotch AI', 'Mostra nel file della sessione']);
    await clicca('.pezzo-chat .menu .voce', 'Copia come Markdown'); await wait(() => window.__copiato.length === 1);
    await clicca('.risposta .azioni button', 'Altre azioni'); await clicca('.pezzo-chat .menu .voce', 'Copia testo'); await wait(() => window.__copiato.length === 2);
    assert.deepEqual(await run(() => window.__copiato), [md, 'Titolo\n\ngrassetto e codice']); // blocchi separati da riga vuota (#440)
    await clicca('.risposta .azioni button', 'Altre azioni'); await clicca('.pezzo-chat .menu .voce', 'Mostra nel file della sessione'); await attesa(50);
    assert.deepEqual(fatte('sessioni:azione'), [['s1', 'mostra-nel-finder']]);
    await clicca('.risposta .azioni button', 'Altre azioni'); await tasto('body', { key: 'Escape' }); await wait(() => !document.querySelector('.pezzo-chat .menu'));
  });

  await req('K2', async () => {
    nuova((s) => { s.messaggi.s1 = [U('domanda'), AS('Risposta da copiare', 1000)]; s.elenco.sessioni[0].stato = 'finita'; }); await caricaChat(); await copiaFinta();
    await wait(() => !!document.querySelector('.risposta .azioni'));
    assert.equal(await run(() => !!document.querySelector('.risposta .suggerimento')), false, 'prima del clic non c\'è «Copiato»');
    await clicca('.risposta .azioni button', 'Copia'); await wait(() => document.querySelector('.risposta .suggerimento')?.textContent === 'Copiato');
    assert.deepEqual(await run(() => window.__copiato), ['Risposta da copiare']);
    await wait(() => !document.querySelector('.risposta .suggerimento'));
  });

  await req('D8', async () => {
    nuova((s) => { s.messaggi.s1 = [U('domanda'), PE('ragiono sul problema', 1000)]; }); await caricaChat();
    await wait(() => document.querySelector('.pensiero .etichetta')?.textContent === 'Ragionando…');
    assert.equal(await run(() => document.querySelector('.pensiero button')), null, 'in corso non si apre');
    nuova((s) => { s.messaggi.s1 = [U('domanda'), PE('ragiono sul problema', 1000), AS('ecco', 5000)]; s.elenco.sessioni[0].stato = 'finita'; }); await caricaChat();
    await wait(() => /^Ragionato per/.test(document.querySelector('.pensiero .etichetta')?.textContent || ''));
    assert.equal(await run(() => !!document.querySelector('.testo-pensiero')), false); await clicca('.pensiero button', 'Ragionato per 4 s');
    assert.deepEqual(await testo('.testo-pensiero'), ['ragiono sul problema']);
  });

  await req('D9', async () => {
    nuova((s) => { s.messaggi.s1 = [U('domanda'), PE('p', 1000), AS('prima', 65000), PE('q', 66000), AS('ecco', 3_726_000)]; s.elenco.sessioni[0].stato = 'finita'; }); await caricaChat();
    await wait(() => document.querySelectorAll('.pensiero .etichetta').length === 2);
    assert.deepEqual(await testo('.pensiero .etichetta'), ['Ragionato per 1 min 4 s', 'Ragionato per 1 h 1 min']);
    await wait(() => /^Finita/.test(document.querySelector('.riga-stato .esito')?.textContent || ''));
    assert.match(await run(() => document.querySelector('.riga-stato .esito').textContent), /^Finita in \d/);
  });

  await req('D10', async () => {
    nuova((s) => { s.messaggi.s1 = [U('domanda'), AS('sto scrivendo', 1000)]; }); await caricaChat();
    await wait(() => !!document.querySelector('.risposta .cursore'));
    assert.equal(await run(() => !!document.querySelector('.risposta .azioni')), false, 'mentre scrive niente azioni');
    H.scena.elenco.sessioni[0].stato = 'finita'; H.win.webContents.send('sessioni:aggiornamento', { sessioni: ['s1'], nuoviMessaggi: [] }); // la sessione finisce: via il cursore, tornano le azioni
    await wait(() => !document.querySelector('.risposta .cursore') && !!document.querySelector('.risposta .azioni'));
  });

  await req('F2', async () => {
    nuova((s) => { s.messaggi.s2 = []; }); await carica({ vista: 'sessione', sessione: 's2' });
    await wait(() => !!document.querySelector('.filo.vuoto .messaggio-al-centro'));
    assert.deepEqual(await testo('.filo.vuoto .messaggio-al-centro > div'), ['Nessun messaggio', 'Scrivi per iniziare.']);
    assert.equal(await run(() => !!document.querySelector('textarea')), true, 'la casella c\'è anche senza messaggi');
  });

  await req('F3', async () => {
    const tieni = []; nuova();
    rispondi['sessioni:messaggi'] = (...a) => new Promise((res) => tieni.push(() => res(H.rispostaScena(H.scena, 'sessioni:messaggi', a))));
    await carica({ vista: 'sessione', sessione: 's1' }); await wait(() => !!document.querySelector('.sagome[aria-busy=true]'));
    const r = await run(() => { const f = document.querySelector('.sagome'); return { righe: f.querySelectorAll('.riga').length, larghezze: [...f.querySelectorAll('.riga > div')].map((e) => e.getBoundingClientRect().width), colonna: f.getBoundingClientRect().width }; });
    assert.ok(r.righe >= 3 && r.larghezze.length >= r.righe, JSON.stringify(r)); assert.ok(r.larghezze.every((w) => w > 0 && w <= r.colonna + 1), 'sagome dentro la colonna');
    delete rispondi['sessioni:messaggi']; tieni.forEach((f) => f()); await wait(() => !document.querySelector('.sagome') && !!document.querySelector('.messaggio-roberto .bolla'));
  });

  await req('F4', async () => {
    nuova((s) => { s.registro.chat.s1.battito = ora - NON_RISPONDE_MS + 300000; }); await carica({ vista: 'sessione', sessione: 's1' }); // sotto soglia: ancora al lavoro
    await wait(() => !!document.querySelector('.intestazione .stato'));
    assert.doesNotMatch(await run(() => document.querySelector('.intestazione .stato').textContent), /Non risponde/);
    assert.equal(await run(() => !!document.querySelector('.avviso-filo.errore')), false, 'sotto soglia nessun avviso «non risponde»');
    nuova((s) => { s.registro.chat.s1.battito = ora - NON_RISPONDE_MS - 60000; }); await carica({ vista: 'sessione', sessione: 's1' }); // oltre la soglia del motore
    await wait(() => /non risponde/.test(document.querySelector('.avviso-filo.errore .titolo')?.textContent || ''));
    assert.match(await run(() => document.querySelector('.intestazione .stato').textContent), /Non risponde/);
    assert.equal(await run(() => document.querySelector('textarea').placeholder), 'In attesa della sessione');
    await clicca('.avviso-filo button', 'Apri nel terminale'); await attesa(50); assert.deepEqual(fatte('sessioni:azione'), [['s1', 'apri-terminale']]);
    nuova(); rispondi['sessioni:messaggi'] = () => { throw new Error('boom lettura'); }; await carica({ vista: 'sessione', sessione: 's1' });
    await wait(() => /Messaggi non letti/.test(document.body.innerText)); delete rispondi['sessioni:messaggi'];
    await clicca('.messaggio-al-centro button', 'Riprova'); await wait(() => !!document.querySelector('.messaggio-roberto .bolla'));
  }, { consenti: /boom lettura|Error occurred in handler/ });

  await req('F6', async () => {
    nuova((s) => { const c = s.registro.chat.s1; c.stato = 'serve_roberto'; c.richieste = [{ rid: 'r1', genere: 'permesso', strumento: 'Bash', ingresso: { command: 'rm -rf dist', description: 'Svuota la build.' }, domande: [] }]; s.elenco.sessioni[0].stato = 'aspetta'; });
    await caricaChat(); await wait(() => !!document.querySelector('.carta, [class*=carta]') && /Permesso richiesto/.test(document.body.innerText));
    assert.ok((await testo('.bottoni button')).join('|').includes('Consenti|Consenti sempre|Nega'), 'tre bottoni');
    rispondi['clotch-ai:comando'] = () => ({ esito: 'errore', testo: 'no' });
    await clicca('.bottoni button', 'Consenti'); await wait(() => /Sessione non raggiunta/.test(document.body.innerText));
    assert.match(await run(() => document.body.innerText), /Permesso richiesto/);
    delete rispondi['clotch-ai:comando']; H.azzera();
    await clicca('.bottoni button', 'Nega'); await wait(() => /Negato da te/.test(document.body.innerText));
    assert.deepEqual(fatte('clotch-ai:comando'), [['rispondi_permesso', { chat: 's1', rid: 'r1', scelta: 'nega' }]]);
    assert.equal(await run(() => /Permesso richiesto/.test(document.body.innerText)), false);
  });

  await req('A9', async () => {
    nuova(); await caricaChat();
    const cart = () => run(() => [...document.querySelectorAll('.barra-laterale button.riga[aria-expanded]')].map((b) => [b.querySelector('.testo').textContent, b.getAttribute('aria-expanded'), b.querySelector('.lato').textContent]));
    assert.deepEqual(await cart(), [['beta-app', 'false', '1'], ['clotch', 'true', '2']]); assert.deepEqual(await barra(), ['Gamma tre', 'Alfa uno']);
    await riga('beta-app'); assert.deepEqual(await cart(), [['beta-app', 'true', '1'], ['clotch', 'true', '2']]); assert.deepEqual(await barra(), ['Beta due', 'Gamma tre', 'Alfa uno']);
    await riga('clotch'); assert.deepEqual(await cart(), [['beta-app', 'true', '1'], ['clotch', 'false', '2']]); assert.deepEqual(await barra(), ['Beta due']);
    await riga('clotch'); assert.deepEqual(await barra(), ['Beta due', 'Gamma tre', 'Alfa uno']);
  });

  await req('A11', async () => {
    nuova(); await caricaChat(); await riga('beta-app');
    const righe = () => run(() => Object.fromEntries([...document.querySelectorAll('.riga-sessione')].map((r) => [r.querySelector('.testo').textContent,
      { lavoro: r.querySelector('.testo').classList.contains('lavoro'), segno: r.querySelector('.segno svg')?.getAttribute('style'), scelta: r.classList.contains('scelta') }])));
    let r = await righe();
    assert.deepEqual([r['Alfa uno'].lavoro, r['Beta due'].lavoro, r['Gamma tre'].lavoro], [true, false, false]);
    assert.deepEqual([r['Alfa uno'].scelta, r['Beta due'].scelta], [true, false]);
    assert.equal(new Set(Object.values(r).map((x) => x.segno)).size, 3, 'tre stati, tre segni diversi');
    H.scena.elenco.sessioni[1].stato = 'aspetta'; aggiorna('s2'); await wait(() => document.querySelectorAll('.riga-sessione .segno svg').length === 3); await attesa(80);
    r = await righe(); assert.equal(r['Beta due'].segno, r['Gamma tre'].segno, 'il segno segue lo stato dal vivo');
    H.scena.elenco.sessioni[0].stato = 'finita'; aggiorna('s1'); await wait(() => !document.querySelector('.riga-sessione .testo.lavoro'));
  });

  await req('A13', async () => {
    nuova(); await caricaChat();
    const r = await run(() => { const b = [...document.querySelectorAll('.riga-sessione')].find((x) => x.textContent.includes('Gamma tre')).getBoundingClientRect(); return { x: b.x + 40, y: b.y + b.height / 2 }; });
    const az = () => run(() => { const g = [...document.querySelectorAll('.riga-sessione')].find((x) => x.textContent.includes('Gamma tre')); return [getComputedStyle(g.querySelector('.azioni')).display, getComputedStyle(g.querySelector('.segno')).display]; });
    assert.deepEqual(await az(), ['none', 'block'], 'a riposo: segno di stato, niente azioni');
    H.win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(r.x), y: Math.round(r.y) }); await wait(() => [...document.querySelectorAll('.riga-sessione')].find((x) => x.textContent.includes('Gamma tre')).matches(':hover'));
    assert.deepEqual(await az(), ['flex', 'none'], 'al passaggio: azioni al posto del segno');
    rispondi['sessioni:imposta-preferenze'] = (id, p) => { H.scena.preferenze = { ...H.scena.preferenze, [id]: { ...H.scena.preferenze[id], ...p } }; H.win.webContents.send('sessioni:preferenze', H.scena.preferenze); };
    await run(() => [...document.querySelectorAll('.riga-sessione')].find((x) => x.textContent.includes('Gamma tre')).querySelector('button[aria-label="Fissa in alto"]').click());
    await wait(() => /Fissate/.test(document.querySelector('.elenco').innerText));
    assert.deepEqual(fatte('sessioni:imposta-preferenze'), [['s3', { fissa: true }]]); assert.equal(await run(() => document.querySelector('.riga-sessione.scelta .testo').textContent), 'Alfa uno', 'fissare non cambia la sessione aperta');
    await run(() => document.querySelector('.riga-sessione button[aria-label="Fissa in alto"]').click()); await attesa(60);
    assert.deepEqual(fatte('sessioni:imposta-preferenze').at(-1), ['s3', { fissa: null }], 'un secondo clic toglie');
    await run(() => document.querySelector('.riga-sessione button[aria-label="Altre azioni"]').click()); await wait(() => !!document.querySelector('.menu[role=menu]'));
  });

  await req('C3', async () => {
    nuova(); await caricaChat();
    const menu = () => run(() => { const g = [...document.querySelectorAll('.riga-sessione')].find((x) => x.textContent.includes('Gamma tre')), b = g.getBoundingClientRect();
      g.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + 30, clientY: b.y + 5 })); return [b.x + 30, b.y + 5]; });
    const p = await menu(); await wait(() => !!document.querySelector('.menu[role=menu]'));
    assert.deepEqual(await testo('.menu .etichetta'), ['Fissa in alto', 'Rinomina…', 'Archivia', 'Segna come non letta', 'Apri in una nuova finestra', 'Copia ID sessione', 'Copia cartella di lavoro', 'Copia link alla sessione', 'Mostra nel Finder']);
    assert.deepEqual(await run(() => { const s = document.querySelector('.menu').style; return [parseFloat(s.left), parseFloat(s.top)]; }), p, 'il menu si apre dove hai cliccato');
    await clicca('.menu .voce .etichetta', 'Copia ID sessione'); await wait(() => !document.querySelector('.menu')); assert.deepEqual(fatte('sessioni:azione'), [['s3', 'copia-id']]);
    await menu(); await voce('Archivia'); await attesa(50); assert.deepEqual(fatte('clotch-ai:comando'), [['archivia', { chat: 's3' }]]);
    await menu(); await voce('Segna come non letta'); await attesa(50); assert.deepEqual(fatte('sessioni:imposta-preferenze'), [['s3', { nonLetta: true }]]);
    await menu(); await esc(); await wait(() => !document.querySelector('.menu'));
    await menu(); await run(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); await wait(() => !document.querySelector('.menu'));
  });

  await req('A18', async () => {
    nuova(); await caricaChat(); await scrivi('textarea', 'bozza che resta');
    await clicca('button', 'Barra laterale'); await wait(() => !document.querySelector('.barra-laterale'));
    assert.equal(await run(() => document.querySelector('button[aria-label="Barra laterale"]').getAttribute('aria-pressed')), 'false');
    assert.equal(await run(() => document.querySelector('textarea').value), 'bozza che resta'); assert.deepEqual(await testo('.messaggio-roberto .bolla'), ['Messaggio A uno']);
    await clicca('button', 'Barra laterale'); await wait(() => !!document.querySelector('.barra-laterale'));
    await tasto('body', { key: '\\', code: 'Backslash', metaKey: true }); await wait(() => !document.querySelector('.barra-laterale'));
    await tasto('body', { key: '\\', code: 'Backslash', metaKey: true }); await wait(() => !!document.querySelector('.barra-laterale'));
    assert.equal(await run(() => document.querySelector('textarea').value), 'bozza che resta');
  });

});
