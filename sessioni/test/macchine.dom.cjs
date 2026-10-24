// Macchine SSH di «Nuova sessione» (#479) nel renderer reale, IPC intercettato: il menu legge `macchine` (mai ~/.ssh/config), la macchina di base non si toglie, «Aggiungi macchina» manda
// `macchina_aggiungi`, la preparazione segue gli eventi `macchina_passo` dal vivo, un passo fallito si riprova con lo stesso comando, il comando di login si copia, GitHub mostra il codice,
// una macchina da completare non apre sessioni. Finestra mai visibile, mai attiva, muta.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena, rispostaScena } = require(path.join(root, 'dist/src/scena.js'));

app.whenReady().then(async () => {
  const scena = structuredClone(require('../design/scene/149-67470.json'));
  scena.registro.passiMacchina = [];
  collegaScena(ipcMain, scena);
  const comandi = [];
  let sblocca = null; // la risposta di `macchina_aggiungi` la dà il test, dopo gli eventi
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => {
    if (cmd === 'macchine') return { id: 'c-m', esito: 'ok', testo: '', ...scena.macchine };
    if (cmd === 'account_previsto') return { id: 'c-a', esito: 'ok', testo: '' };
    comandi.push({ cmd, args });
    if (cmd === 'macchina_aggiungi') return new Promise((ok) => { sblocca = (r) => ok({ id: 'c-agg', testo: '', ...r }); });
    return { id: 'c', esito: 'ok', testo: 'Fatto.', sessione: cmd === 'nuova_sessione' ? 'abcd1234' : undefined };
  });

  const win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  let showEvents = 0, focusEvents = 0;
  win.on('show', () => showEvents++);
  win.on('focus', () => focusEvents++);
  const run = (fn, ...args) => win.webContents.executeJavaScript(`(${fn})(...${JSON.stringify(args)})`);
  const wait = (fn) => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + 5000;
    const tick = () => { if ((${fn})()) resolve(); else if (Date.now() > end) reject(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn))})); else setTimeout(tick, 20); };
    tick();
  })`);
  const attendi = async (fn) => { const fine = Date.now() + 5000; while (!fn()) { if (Date.now() > fine) throw new Error('Attesa scaduta: ' + fn); await new Promise((r) => setTimeout(r, 20)); } };
  const load = async (sezione) => {
    comandi.length = 0; sblocca = null; scena.registro.passiMacchina = [];
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'nuova-sessione', sezione } });
    await wait(new Function(`return !!document.querySelector('.nuova-corpo textarea') && document.querySelectorAll('.selettore').length >= 4`));
  };
  const scrivi = (testo) => run((testo) => {
    const el = document.querySelector('.nuova-corpo textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, testo);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, testo);
  const campo = (etichetta, valore) => run((etichetta, valore) => {
    const el = [...document.querySelectorAll('.dialogo .campo-macchina')].find((c) => c.querySelector('.etichetta-campo').textContent === etichetta).querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, valore);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, etichetta, valore);
  const invio = () => run(() => document.querySelector('.nuova-corpo textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const clicca = (sel, testo) => run((sel, testo) => [...document.querySelectorAll(sel)].find((e) => !testo || e.textContent.includes(testo)).click(), sel, testo);
  const testi = (sel) => run((sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim()), sel);
  const bottoni = () => testi('.dialogo .bottoni button');
  const passo = (nome, passoNome, ok, x = {}) => ({ nome, passo: passoNome, ok, testo: null, comando: null, url: null, codice: null, t: Date.now(), ...x });
  const evento = async (...e) => { scena.registro.passiMacchina.push(...e); win.webContents.send('clotch-ai:registro', rispostaScena(scena, 'clotch-ai:registro', [])); await new Promise((r) => setTimeout(r, 120)); };
  const apriMenuSsh = async () => {
    await clicca('.selettore', 'Questo computer');
    await wait(() => !!document.querySelector('.menu-avvio'));
    if (!(await run(() => !!document.querySelector('.menu-ssh')))) await clicca('.menu-avvio .voce', 'SSH'); // la scena «menu:ssh» lo apre già
    await wait(() => !!document.querySelector('.menu-ssh'));
  };
  const BUILD = { nome: 'build-server', cartella: '/home/deploy/progetti', host: '10.0.4.21', porta: 22, utente: 'deploy', chiave: '~/.ssh/id_ed25519', desktop_id: 'd-build' };
  const failures = [];
  const check = async (name, test) => { try { await test(); console.log(`${name}: OK`); } catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); } };
  try {
    await check('MENU_SSH_DAL_MOTORE_NON_DA_SSH_CONFIG', async () => {
      await load('menu:ssh');
      assert.equal(await run(() => typeof window.nuovaSessione.ssh), 'undefined', 'la lettura di ~/.ssh/config non c\'è più');
      await wait(() => document.querySelectorAll('.menu-ssh .riga-macchina').length === 3);
      assert.deepEqual(await testi('.menu-ssh .riga-macchina .etichetta'), ['rise', 'worker', 'dentalspace-vps']);
      assert.deepEqual(await testi('.menu-ssh .riga-macchina .valore'), ['roberto@rise', 'roberto@worker', 'Da completare']);
      assert.deepEqual(await testi('.menu-ssh .titolo-gruppo'), ['Da Claude Desktop']);
      assert.deepEqual(await testi('.menu-ssh button.voce .etichetta'), ['build-server', 'mac-studio', 'Aggiungi macchina…']);
    });
    await check('BASE_NON_SI_TOGLIE', async () => {
      await load('menu:ssh');
      await wait(() => document.querySelectorAll('.menu-ssh .riga-macchina').length === 3);
      const togli = await run(() => [...document.querySelectorAll('.menu-ssh .riga-macchina')].map((r) => !!r.querySelector('.togli')));
      assert.deepEqual(togli, [false, true, true], 'la macchina di base (tabella) non ha il cestino');
      assert.equal(await run(() => document.querySelector('.menu-ssh .riga-macchina .tooltip').textContent), 'È la macchina di base: non si rimuove.');
    });
    await check('TOGLI_CON_CONFERMA_E_ANNULLA', async () => {
      await load('menu:ssh');
      await wait(() => document.querySelectorAll('.menu-ssh .riga-macchina').length === 3);
      await clicca('.menu-ssh .riga-macchina:nth-child(2) .togli');
      await wait(() => !!document.querySelector('.dialogo'));
      assert.equal(await run(() => document.querySelector('.dialogo [class*="t-lg"]').textContent), 'Rimuovere worker?');
      assert.deepEqual(await bottoni(), ['Annulla', 'Rimuovi']);
      await clicca('.dialogo .bottoni button', 'Annulla');
      await wait(() => !document.querySelector('.dialogo'));
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(comandi.filter((c) => c.cmd === 'macchina_togli').length, 0, 'Annulla non toglie niente');
      await apriMenuSsh();
      await clicca('.menu-ssh .riga-macchina:nth-child(2) .togli');
      await wait(() => !!document.querySelector('.dialogo'));
      await clicca('.dialogo .bottoni button', 'Rimuovi');
      await attendi(() => comandi.some((c) => c.cmd === 'macchina_togli'));
      assert.deepEqual(comandi.find((c) => c.cmd === 'macchina_togli').args, { nome: 'worker' });
    });
    await check('MACCHINA_PRONTA_APRE_SESSIONE_SSH_NELLA_SUA_CARTELLA', async () => {
      await load('menu:ssh');
      await wait(() => document.querySelectorAll('.menu-ssh .riga-macchina').length === 3);
      await clicca('.menu-ssh .riga-macchina', 'rise');
      await wait(() => [...document.querySelectorAll('.selettore')].some((e) => e.textContent.trim() === 'rise'));
      assert.deepEqual(await testi('.selettore'), ['rise', '/srv/clotch', 'dev', 'Copia di lavoro']);
      await scrivi('Controlla i test');
      await invio();
      await attendi(() => comandi.some((c) => c.cmd === 'nuova_sessione'));
      assert.deepEqual(comandi.find((c) => c.cmd === 'nuova_sessione').args, { ambiente: 'ssh', macchina: 'rise', cartella: '/srv/clotch', worktree: true, branch: 'dev',
        modello: 'claude-opus-5-5', sforzo: 'medium', prompt: 'Controlla i test' });
    });
    await check('MACCHINA_DA_COMPLETARE_BLOCCA_L_INVIO', async () => {
      await load('ambiente:dentalspace-vps|testo:Controlla i test del motore');
      await wait(() => !!document.querySelector('.riga-avviso-macchina'));
      assert.equal(await run(() => document.querySelector('.riga-avviso-macchina .motivo').textContent), 'dentalspace-vps non è pronta: la preparazione si è fermata a Claude.');
      assert.equal(await run(() => document.querySelector('.bottone-invia').disabled), true);
      await invio();
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(comandi.filter((c) => c.cmd === 'nuova_sessione').length, 0, 'nessuna sessione su una macchina da completare');
    });
    await check('COMPLETA_LA_PREPARAZIONE_RIMANDA_LO_STESSO_COMANDO_E_FINISCE', async () => {
      await load('ambiente:dentalspace-vps|testo:Controlla i test del motore');
      await wait(() => !!document.querySelector('.riga-avviso-macchina'));
      await clicca('.riga-avviso-macchina button', 'Completa la preparazione');
      await wait(() => !!document.querySelector('.dialogo .avviso-passo'));
      assert.match(await run(() => document.querySelector('.dialogo .avviso-passo .titolo').textContent), /Claude non è installato/);
      assert.deepEqual(await bottoni(), ['Chiudi', 'Riprova']);
      await clicca('.dialogo .bottoni button', 'Riprova');
      await attendi(() => comandi.some((c) => c.cmd === 'macchina_aggiungi'));
      assert.deepEqual(comandi.find((c) => c.cmd === 'macchina_aggiungi').args, { nome: 'dentalspace-vps', cartella: '/srv/clotch', host: 'dentalspace-vps', porta: 22, utente: 'roberto' });
      await wait(() => [...document.querySelectorAll('.dialogo .nota-passi')].some((n) => n.textContent.startsWith('Riprende da Claude.')));
      assert.deepEqual(await bottoni(), [], 'niente «Chiudi» durante la preparazione');
      sblocca({ esito: 'ok', testo: 'dentalspace-vps è pronta.' });
      await wait(() => document.querySelector('.dialogo [class*="t-lg"]').textContent === 'Macchina pronta');
      assert.deepEqual(await testi('.dialogo .dettaglio-passo').then((d) => d.length), 7);
      assert.deepEqual(await bottoni(), ['Chiudi', 'Nuova sessione']);
    });
    await check('AGGIUNGI_DA_PROPOSTA_PREPARAZIONE_DAL_VIVO_E_RIPROVA', async () => {
      await load('vuota');
      await apriMenuSsh();
      await clicca('.menu-ssh button.voce', 'build-server');
      await wait(() => !!document.querySelector('.dialogo .campi-macchina'));
      assert.equal(await run(() => [...document.querySelectorAll('.dialogo .casella-macchina')].map((i) => i.value).join('|')), '10.0.4.21|22|deploy|~/.ssh/id_ed25519|build-server|/home/deploy/progetti');
      await campo('Nome', 'Build Server');
      await wait(() => !!document.querySelector('.dialogo .messaggio-campo'));
      assert.equal(await run(() => document.querySelector('.dialogo .messaggio-campo').textContent), 'Usa minuscole, numeri e trattini (massimo 32).');
      await clicca('.dialogo .bottoni button', 'Aggiungi');
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(comandi.length, 0, 'un nome non valido non parte');
      await campo('Nome', 'build-server');
      await clicca('.dialogo .bottoni button', 'Aggiungi');
      await attendi(() => comandi.length === 1);
      assert.deepEqual(comandi[0], { cmd: 'macchina_aggiungi', args: BUILD });
      // preparazione dal vivo: ogni evento `macchina_passo` cambia una riga
      await evento(passo('build-server', 'connessione', true), passo('build-server', 'python', true, { testo: '3.11.2' }), passo('build-server', 'cartella', null));
      await wait(() => document.querySelectorAll('.dialogo .passo.ok').length === 2 && document.querySelectorAll('.dialogo .passo.corso').length === 1);
      assert.deepEqual(await testi('.dialogo .dettaglio-passo').then((d) => d.slice(0, 4)), ['Collegata', '3.11.2', 'In corso', 'In attesa']);
      assert.deepEqual(await bottoni(), [], 'durante la preparazione nessun «Chiudi»');
      await run(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      await new Promise((r) => setTimeout(r, 150));
      assert.equal(await run(() => !!document.querySelector('.dialogo')), true, 'Esc non chiude mentre il motore lavora');
      // passo fallito: il testo del motore e «Riprova»
      await evento(passo('build-server', 'cartella', true), passo('build-server', 'claude', false, { testo: 'Claude non è installato. Il comando claude non esiste su build-server. Installalo sulla macchina, poi riprova.' }));
      sblocca({ esito: 'rifiutato', testo: 'Claude non è installato.' });
      await wait(() => !!document.querySelector('.dialogo .avviso-passo'));
      assert.equal(await run(() => document.querySelector('.dialogo .avviso-passo .titolo').textContent), 'Claude non è installato');
      assert.equal(await run(() => document.querySelector('.dialogo .passo.no .dettaglio-passo').textContent), 'Non riuscito');
      assert.deepEqual(await bottoni(), ['Chiudi', 'Riprova']);
      await clicca('.dialogo .bottoni button', 'Riprova');
      await attendi(() => comandi.length === 2);
      assert.deepEqual(comandi[1], comandi[0], '«Riprova» rimanda lo stesso comando');
      await wait(() => [...document.querySelectorAll('.dialogo .dettaglio-passo')].some((d) => d.textContent === 'Ripreso da qui'));
      await evento(passo('build-server', 'claude', true, { testo: '2.1.4' }), passo('build-server', 'motore', true), passo('build-server', 'login', true), passo('build-server', 'github', true));
      sblocca({ esito: 'ok', testo: 'build-server è pronta.', passi: [] });
      await wait(() => document.querySelector('.dialogo [class*="t-lg"]').textContent === 'Macchina pronta');
      assert.equal(await run(() => document.querySelectorAll('.dialogo .passo.ok').length), 7);
      await clicca('.dialogo .bottoni button', 'Nuova sessione');
      await wait(() => !document.querySelector('.dialogo') && [...document.querySelectorAll('.selettore')].some((e) => e.textContent.trim() === 'build-server'));
    });
    await check('MODULO_INVIO_ERRORI_CON_TESTO_E_FUOCO_AL_CAMPO_SBAGLIATO', async () => {
      await load('vuota');
      await apriMenuSsh();
      await clicca('.menu-ssh button.voce', 'Aggiungi macchina');
      await wait(() => !!document.querySelector('.dialogo .campi-macchina'));
      const invio = () => run(() => document.querySelector('.dialogo input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      await invio();
      await wait(() => document.querySelectorAll('.dialogo .messaggio-campo').length === 3);
      assert.deepEqual(await testi('.dialogo .messaggio-campo'), ['Serve l’indirizzo della macchina.', 'Usa minuscole, numeri e trattini (massimo 32).', 'Serve un percorso che parte da «/».']);
      await wait(() => document.activeElement === document.querySelector('.dialogo input[aria-invalid=true]'));
      assert.equal(comandi.filter((c) => c.cmd === 'macchina_aggiungi').length, 0, 'il modulo vuoto non parte');
      await campo('Indirizzo', '10.0.4.9'); await campo('Nome', 'mac-prova'); await campo('Cartella', '/srv/prova');
      await invio();
      await attendi(() => comandi.some((c) => c.cmd === 'macchina_aggiungi'));
    });
    await check('TASTIERA_MENU_MAC_FRECCIA_DESTRA_SINISTRA_HOME_FINE_E_NOMI', async () => {
      await load('vuota');
      await clicca('.selettore', 'Questo computer');
      await wait(() => !!document.querySelector('.menu-avvio'));
      const tasto = (key) => run((key) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })), key);
      const fuoco = () => run(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim().slice(0, 30));
      await run(() => [...document.querySelectorAll('.menu-avvio .voce')].find((e) => e.textContent.trim() === 'Cloud').focus());
      await tasto('End');
      assert.equal(await run(() => document.activeElement.textContent.trim()), 'SSH', 'Fine va all’ultima voce attiva (Crea ambiente è spenta)');
      await tasto('Home');
      assert.equal(await run(() => document.activeElement.textContent.trim()), 'Questo computer');
      await run(() => [...document.querySelectorAll('.menu-avvio .voce')].find((e) => e.textContent.trim() === 'SSH').focus());
      assert.equal(await run(() => document.activeElement.getAttribute('aria-expanded')), 'false');
      await tasto('ArrowRight');
      await wait(() => !!document.querySelector('.menu-ssh') && document.activeElement.closest('.menu-ssh'));
      assert.equal(await fuoco(), 'rise, roberto@rise', 'il nome per VoiceOver è nome e utente, senza il suggerimento');
      await tasto('ArrowDown');
      assert.equal(await fuoco(), 'worker, roberto@worker');
      await tasto('ArrowLeft');
      await wait(() => !document.querySelector('.menu-ssh'));
      assert.equal(await run(() => document.activeElement.textContent.trim()), 'SSH', '← chiude il pannello e il fuoco torna su SSH');
    });
    await check('LOGIN_MANCANTE_COMANDO_DA_COPIARE_E_HO_FATTO_RIPROVA', async () => {
      await load('vuota');
      await apriMenuSsh();
      await clicca('.menu-ssh button.voce', 'build-server');
      await wait(() => !!document.querySelector('.dialogo .campi-macchina'));
      await clicca('.dialogo .bottoni button', 'Aggiungi');
      await attendi(() => comandi.length === 1);
      const comando = "ssh -t deploy@10.0.4.21 'claude login'";
      await evento(passo('build-server', 'connessione', true), passo('build-server', 'login', false, { comando }));
      sblocca({ esito: 'rifiutato', testo: 'Accedi a Claude.' });
      await wait(() => !!document.querySelector('.dialogo .codice-macchina'));
      assert.equal(await run(() => document.querySelector('.dialogo .codice-macchina').textContent), comando);
      assert.equal(await run(() => document.querySelector('.dialogo .titolo-comando').textContent), 'Accedi a Claude dal Terminale del Mac');
      assert.equal(await run(() => document.querySelector('.dialogo .passo.mano .dettaglio-passo').textContent), 'Da fare nel Terminale');
      assert.deepEqual(await bottoni(), ['Chiudi', 'Riprova']);
      await clicca('.dialogo .riga-comando button', 'Copia');
      await wait(() => [...document.querySelectorAll('.dialogo .riga-comando button')].some((b) => b.textContent === 'Copiato'));
      await clicca('.dialogo .bottoni button', 'Riprova');
      await attendi(() => comandi.length === 2);
      assert.deepEqual(comandi[1], comandi[0]);
    });
    await check('GITHUB_CODICE_E_BOTTONE_UNICO', async () => {
      await load('vuota');
      await apriMenuSsh();
      await clicca('.menu-ssh button.voce', 'build-server');
      await wait(() => !!document.querySelector('.dialogo .campi-macchina'));
      await clicca('.dialogo .bottoni button', 'Aggiungi');
      await attendi(() => comandi.length === 1);
      await evento(passo('build-server', 'github', null, { url: 'https://github.com/login/device', codice: '8F3A-21C7' }));
      await wait(() => !!document.querySelector('.dialogo .codice-grande'));
      assert.equal(await run(() => document.querySelector('.dialogo [class*="t-lg"]').textContent), 'Collega GitHub');
      assert.equal(await run(() => document.querySelector('.dialogo .codice-grande').textContent), '8F3A-21C7');
      assert.deepEqual(await testi('.dialogo .codice-github button'), ['Copia il codice e apri GitHub']);
      assert.deepEqual(await bottoni(), [], 'nessun altro bottone');
    });
    assert.deepEqual(failures, []);
    assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false);
    assert.equal(showEvents, 0); assert.equal(focusEvents, 0); assert.equal(win.webContents.isAudioMuted(), true);
    console.log(`MACCHINE_OK show=${showEvents} focus=${focusEvents}`); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
