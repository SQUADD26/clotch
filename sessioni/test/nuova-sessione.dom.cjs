// «Nuova sessione» nel renderer reale (#468), IPC intercettato: invio manda `nuova_sessione` coi campi scelti, cartella senza git senza ramo né worktree,
// rifiuto del motore (Cloud) nell'avviso. Finestra mai visibile, mai attiva, muta.
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
  const scena = structuredClone(require('../design/scene/148-51982.json'));
  collegaScena(ipcMain, scena);
  const comandi = [];
  let esito = { esito: 'ok', testo: 'Sessione aperta.' };
  ipcMain.removeHandler('clotch-ai:comando');
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { comandi.push({ cmd, args }); return { id: 'c', ...esito }; });

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
  const load = async (sezione, selettori = 4) => {
    comandi.length = 0;
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'nuova-sessione', sezione } });
    await wait(new Function(`return !!document.querySelector('.nuova-corpo textarea') && document.querySelectorAll('.selettore').length >= ${selettori}`));
  };
  const scrivi = (testo) => run((testo) => {
    const el = document.querySelector('.nuova-corpo textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, testo);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, testo);
  const invio = () => run(() => document.querySelector('.nuova-corpo textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const selettori = () => run(() => [...document.querySelectorAll('.selettore')].map((e) => e.textContent.trim()));
  const clicca = (sel, testo) => run((sel, testo) => [...document.querySelectorAll(sel)].find((e) => !testo || e.textContent.includes(testo)).click(), sel, testo);
  const attendi = async (fn) => { const fine = Date.now() + 5000; while (!fn()) { if (Date.now() > fine) throw new Error('Attesa scaduta: ' + fn); await new Promise((r) => setTimeout(r, 20)); } };
  const failures = [];
  const check = async (name, test) => { try { await test(); console.log(`${name}: OK`); } catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); } };
  try {
    await check('INVIO_MANDA_NUOVA_SESSIONE_COI_CAMPI', async () => {
      esito = { esito: 'ok', testo: 'Sessione aperta.', sessione: 'abcd1234', macchina: 'mac' };
      await load('vuota');
      assert.deepEqual(await selettori(), ['Questo computer', 'goal-notch', 'dev', 'Worktree']);
      await scrivi('Aggiungi lo stato vuoto');
      await invio();
      await attendi(() => comandi.length === 1);
      assert.deepEqual(comandi[0], { cmd: 'nuova_sessione', args: { ambiente: 'locale', cartella: '/Users/roberto/Repos/goal-notch', worktree: true, branch: 'dev',
        modello: 'claude-opus-5-5', sforzo: 'medium', prompt: 'Aggiungi lo stato vuoto' } });
      // la sessione nata si apre per id: la vista Nuova sessione sparisce
      await wait(() => !document.querySelector('.nuova-corpo'));
    });
    await check('CARTELLA_SENZA_GIT_NIENTE_RAMO_NE_WORKTREE', async () => {
      await load('cartella:appunti', 2);
      assert.deepEqual(await selettori(), ['Questo computer', 'appunti']);
      assert.equal(await run(() => document.querySelector('.avviso-avvio .titolo').textContent), '«appunti» non è un repo git');
      await scrivi('Prendi nota');
      await invio();
      await attendi(() => comandi.length === 1);
      assert.deepEqual(comandi[0].args, { ambiente: 'locale', cartella: '/Users/roberto/appunti', modello: 'claude-opus-5-5', sforzo: 'medium', prompt: 'Prendi nota' });
    });
    await check('WORKTREE_SPENTO_E_RAMO_SCELTO', async () => {
      await load('vuota');
      await clicca('.selettore', 'Worktree');
      await wait(() => [...document.querySelectorAll('.selettore')].some((e) => e.textContent.includes('Senza worktree')));
      assert.equal(await run(() => document.querySelector('.nota-avvio').textContent), 'Lavora su dev direttamente dentro goal-notch.');
      await clicca('.selettore', 'dev');
      await wait(() => !!document.querySelector('.menu-avvio input'));
      await clicca('.menu-avvio .voce', 'main');
      await scrivi('Ciao');
      await invio();
      await attendi(() => comandi.length === 1);
      assert.equal(comandi[0].args.branch, 'main'); assert.equal(comandi[0].args.worktree, false);
    });
    await check('CLOUD_RIFIUTATO_NELL_AVVISO', async () => {
      esito = { esito: 'rifiutato', testo: 'Una sessione cloud non si apre dal motore: aprila dall\'app Claude.' };
      await load('vuota');
      await clicca('.selettore', 'Questo computer');
      await wait(() => !!document.querySelector('.menu-avvio'));
      await clicca('.menu-avvio .voce', 'Cloud');
      await wait(() => [...document.querySelectorAll('.selettore')].some((e) => e.textContent.trim() === 'Cloud'));
      await scrivi('Ciao');
      await invio();
      await attendi(() => comandi.length === 1);
      assert.equal(comandi[0].args.ambiente, 'cloud');
      await wait(() => !!document.querySelector('.avviso-comparsa'));
      assert.match(await run(() => document.querySelector('.avviso-comparsa .messaggio').textContent), /aprila dall'app Claude/);
      assert.equal(await run(() => [...document.querySelectorAll('.avviso-comparsa button')].some((b) => b.textContent.includes('Riprova'))), false, 'rifiutato: niente «Riprova»');
      await wait(() => !document.querySelector('.nuova-corpo textarea').disabled);
    });
    assert.deepEqual(failures, []);
    assert.equal(win.isVisible(), false); assert.equal(win.isFocused(), false);
    assert.equal(showEvents, 0); assert.equal(focusEvents, 0); assert.equal(win.webContents.isAudioMuted(), true);
    console.log(`NUOVA_SESSIONE_OK show=${showEvents} focus=${focusEvents}`); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
