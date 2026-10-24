// Bottone account in fondo alla barra (#478) nel renderer vero: conto alla rovescia vivo, menu di uso, 90 % (stato giallo).
// #1146: un solo account, quello delle sessioni nuove, scelto e salvato; la sessione aperta e l'uso non lo cambiano; l'uso è per email intera.
// Finestra nascosta e muta; il finto main registra i comandi a clotch AI.
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
const H = 3_600_000, M = 60_000, S = 1000;
const quota = (account, cinque, cf, sette, sf) => ({ account, email: `${account}@example.com`, cartelle: [`.claude-${account}`], usato: sette, ripartenza: '', cinque, cinqueFine: Date.now() + cf, sette, setteFine: Date.now() + sf });
const quote = (cinque = 38) => [
  quota('accountmanager', cinque, 2 * H + 14 * M + 8 * S + 900, 61, 3 * 24 * H + 5 * H + 12 * M + 40 * S),
  quota('squadd', 72, 3 * H, 40, 2 * 24 * H), quota('friday', 100, 47 * M + 30 * S, 88, 24 * H), { ...quota('dentalspace', 12, 4 * H, 20, 5 * 24 * H), cartelle: ['.claude-terminal-dentalspace'] },
  { ...quota('info', 50, 4 * H, 50, 5 * 24 * H), email: 'info@squaddcrm.com', cartelle: [] }, // un account del feed senza cartella su questo Mac: non si sceglie
];
const chat = (sorgente, account) => ({ chat: 's1', titolo: null, madre: null, progetto: null, account, sorgente, stato: null, richieste: [], coda: [], passi: [], aiutanti: {} });
const elencoPieno = scene.elenco;
const comandi = [];
let win, mostrate = 0, fuochi = 0;
const run = async (fn, ...a) => {
  const r = await win.webContents.executeJavaScript(`(async () => { try { return { v: await (${fn})(...${JSON.stringify(a)}) }; } catch (e) { return { e: String(e && e.message || e) }; } })()`);
  if (r.e) throw new Error(r.e);
  return r.v;
};
const wait = (fn, ...a) => win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 4000; const f = ${fn};
  const t = () => { let v = false; try { v = f(...${JSON.stringify(a)}); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 110))})) : setTimeout(t, 30); }; t(); })`);
const testo = (sel) => run((s) => document.querySelector(s)?.textContent ?? null, sel);
const clicca = (sel, t) => run((sel, t) => { const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').includes(t)); if (!el) throw new Error('manca ' + sel + ' ' + t); el.click(); }, sel, t);
// scenario: tipo di chat nel registro (null = nessuna chat), quote, sessione aperta o nuova
// `scelto`: l'account salvato per le sessioni nuove (undefined = quello di prima, null = nessuno)
const carica = async ({ sorgente = 'motore', cinque, nuova = false, account = '.claude-accountmanager', elenco = elencoPieno, quoteExtra = false, scelto, attesa = '.piede-account .uso-piede' }) => {
  if (scelto !== undefined) scene.impostazioni = scelto ? { accountNuove: scelto } : null;
  scene.uso = quote(cinque);
  if (quoteExtra) scene.uso[3] = { ...scene.uso[3], cartelle: ['.claude'] }; // la quota di ~/.claude (il motore la chiama «default»)
  scene.registro = { ...scene.registro, chat: sorgente ? { s1: chat(sorgente, account) } : {} };
  scene.elenco = elenco;
  scene.navigazione = nuova ? { vista: 'nuova-sessione' } : { vista: 'sessione', sessione: 's1' };
  comandi.length = 0;
  await win.loadFile(path.join(root, 'renderer/index.html'), { query: nuova ? { vista: 'nuova-sessione' } : { vista: 'sessione', sessione: 's1' } });
  // la funzione gira nella finestra: niente variabili di qui dentro
  await (attesa === '.piede-account' ? wait(() => !!document.querySelector('.piede-account')) : wait(() => !!document.querySelector('.piede-account .uso-piede')));
};
const risultati = [];
async function check(nome, fn) {
  let errore = null;
  try { await fn(); } catch (e) { errore = e; }
  risultati.push(!errore);
  console.log(`${errore ? 'FAIL' : 'OK'} ${nome}${errore ? ': ' + String(errore.message).split('\n')[0].slice(0, 220) : ''}`);
}

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene, (c, d) => win.webContents.send(c, d)); // le impostazioni si salvano nella scena, come nel main
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => {
    comandi.push([cmd, args]);
    return cmd === 'account_previsto' ? { id: 'x', esito: 'ok', testo: '', account: { email: 'friday@example.com' } } : { id: 'x', esito: 'ok', testo: '' };
  });
  win = new BrowserWindow({ show: false, focusable: false, width: 1600, height: 1000, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  win.on('show', () => mostrate++); win.on('focus', () => fuochi++);

  await check('PIEDE: account scelto, quote e conto alla rovescia vivo «2 h 14 m 0x s» e «3 g 05 h 12 m 4x s»', async () => {
    await carica({ scelto: 'accountmanager@example.com' });
    assert.equal(await testo('.piede-account .testi .t-base'), 'accountmanager');
    const t = await run(() => [...document.querySelectorAll('.piede-account .uso-piede .testata')].map((e) => [...e.children].map((c) => c.textContent)));
    assert.equal(t[0][0], '5 ore 38%'); assert.equal(t[1][0], '7 giorni 61%');
    assert.match(t[0][1], /^2 h 14 m 0\d s$/); assert.match(t[1][1], /^3 g 05 h 12 m \d\d s$/);
    await new Promise((r) => setTimeout(r, 1300));
    const dopo = await run(() => document.querySelector('.piede-account .uso-piede .testata').lastChild.textContent);
    assert.notEqual(dopo, t[0][1], 'il conto non scorre');
  });

  await check('#1146 STABILE: una sessione di un altro account (cartella, app Claude, fuori dal motore) e la vista nuova non cambiano l’account del piede', async () => {
    const app = elencoPieno.sessioni.map((x) => x.id === 's1' ? { ...x, sorgente: 'claude-desktop', account: 'Claude-dentalspace', email: 'dentalspace@example.com' } : x);
    for (const c of [{ account: '.claude-terminal-dentalspace' }, { sorgente: null, elenco: { ...elencoPieno, sessioni: app } }, { sorgente: 'cli', account: 'friday' }, { nuova: true }]) {
      await carica(c);
      assert.equal(await testo('.piede-account .testi .t-base'), 'accountmanager', JSON.stringify(c).slice(0, 80));
      const t = await run(() => [...document.querySelectorAll('.piede-account .uso-piede .testata')].map((e) => e.children[0].textContent));
      assert.deepEqual(t, ['5 ore 38%', '7 giorni 61%']);
    }
    assert.equal(comandi.filter(([c]) => c === 'account_previsto').length, 0, 'l’account non lo decide il motore a ogni apertura');
  });

  await check('#1146 SENZA SCELTA: l’account di ~/.claude (dentalspace), anche se un altro ha più margine', async () => {
    await carica({ scelto: null, quoteExtra: true });
    assert.equal(await testo('.piede-account .testi .t-base'), 'dentalspace');
    await carica({ cinque: 0, quoteExtra: true });
    assert.equal(await testo('.piede-account .testi .t-base'), 'dentalspace', 'l’uso che cambia non sposta l’account');
  });

  await check('#1146 EMAIL INTERA: scelto info@dentalspace.ai, il feed ha solo info@squaddcrm.com: niente uso di un altro «info»', async () => {
    await carica({ scelto: 'info@dentalspace.ai', attesa: '.piede-account' });
    await wait(() => document.querySelector('.piede-account')?.textContent.includes('Uso non disponibile'));
    assert.equal(await run(() => document.querySelectorAll('.piede-account .uso-piede .testata').length), 0);
  });

  await check('#1146 CAMBIO: «Cambia account» elenca solo gli account con cartella; la scelta si salva, resta dopo un riavvio, nessun riprendi_altrove', async () => {
    await carica({ scelto: 'accountmanager@example.com' });
    await run(() => document.querySelector('.piede-account').click());
    await wait(() => !!document.querySelector('.menu-account'));
    assert.match(await testo('.menu-account'), /5 ore38% usato/);
    assert.match(await testo('.menu-account'), /Riparte tra 2 h 14 m \d\d s/);
    await clicca('.menu-account .voce', 'Cambia account');
    await wait(() => !!document.querySelector('.menu-account.secondo'));
    const nomi = await run(() => [...document.querySelectorAll('.riga-altro .nome .testo')].map((e) => e.textContent));
    assert.deepEqual(nomi, ['squadd', 'friday', 'dentalspace'], 'info (senza cartella) non c’è');
    assert.match(await testo('.riga-altro:nth-of-type(2) .nome'), /Riparte tra 0 h 47 m \d\d s/, 'friday al 100 %: il conto in rosso');
    await clicca('.riga-altro', 'squadd');
    await wait(() => document.querySelector('.piede-account .testi .t-base')?.textContent === 'squadd');
    assert.equal(scene.impostazioni?.accountNuove, 'squadd@example.com');
    assert.equal(comandi.filter(([c]) => c === 'riprendi_altrove').length, 0);
    await carica({});
    assert.equal(await testo('.piede-account .testi .t-base'), 'squadd', 'ricordato dopo il riavvio della finestra');
  });

  await check('90 %: barra gialla, «5 ore quasi finite»; al 100 % barra rossa', async () => {
    await carica({ scelto: 'accountmanager@example.com', cinque: 90 });
    assert.equal(await run(() => !!document.querySelector('.piede-account .pieno.l-giallo')), true);
    await run(() => document.querySelector('.piede-account').click());
    await wait(() => !!document.querySelector('.menu-account .avviso-limite'));
    assert.equal(await testo('.menu-account .avviso-limite'), '5 ore quasi finite');
    await carica({ cinque: 100 });
    assert.equal(await run(() => !!document.querySelector('.piede-account .pieno.l-pieno')), true);
  });

  assert.equal(mostrate, 0, 'nessun evento show'); assert.equal(fuochi, 0, 'nessun evento focus');
  assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false); assert.equal(win.webContents.isAudioMuted(), true);
  console.log(`HIDDEN_WINDOW_OK shows=${mostrate} focus=${fuochi}`);
  console.log(`ACCOUNT_BARRA_RIEPILOGO ok=${risultati.filter(Boolean).length} fail=${risultati.filter((x) => !x).length}`);
  app.exit(risultati.every(Boolean) ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
