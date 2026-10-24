// Dialogo «Quando non vuoi ricevere notifiche?» (149:66688) nel renderer vero (#437): finestra nascosta, IPC simulato, nessun suono.
// Frecce e tastiera cambiano ore e minuti con il giro (23 -> 0, 59 -> 0); «del giorno dopo» a cavallo di mezzanotte; inizio = fine blocca «Salva»; si salva come «22:00–7:00».
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

const scene = JSON.parse(JSON.stringify(require('../design/scene/149-66511.json')));
const salvate = [];
let win;
const run = async (fn, ...a) => {
  const r = await win.webContents.executeJavaScript(`(async () => { try { return { v: await (${fn})(...${JSON.stringify(a)}) }; } catch (e) { return { e: String(e && e.message || e) }; } })()`);
  if (r.e) throw new Error(r.e);
  return r.v;
};
const wait = (fn) => win.webContents.executeJavaScript(`new Promise((ok, ko) => { const fine = Date.now() + 4000; const f = ${fn};
  const t = () => { let v = false; try { v = f(); } catch {} v ? ok() : Date.now() > fine ? ko(new Error('Attesa DOM scaduta: ' + ${JSON.stringify(String(fn).slice(0, 110))})) : setTimeout(t, 15); }; t(); })`);
const tasto = (key) => run((k) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })), key);
const segmenti = () => run(() => [...document.querySelectorAll('[role=dialog] .segmento')].map((s) => s.textContent));
const fuoco = (i) => run((i) => document.querySelectorAll('[role=dialog] .segmento')[i].focus(), i);
const apri = async () => {
  await run(() => document.querySelector('button[aria-label^="Silenzio"]').click());
  await run(() => [...document.querySelectorAll('[role=menu] .voce')].find((e) => e.textContent.trim() === 'Scegli le ore…').click());
  await wait(() => !!document.querySelector('[role=dialog]'));
};
const risultati = [];
async function check(nome, fn) {
  let errore = null;
  try { await fn(); } catch (e) { errore = e; }
  risultati.push(!errore);
  console.log(`${errore ? 'FAIL' : 'OK'} ${nome}${errore ? ': ' + String(errore.message).split('\n')[0].slice(0, 220) : ''}`);
}

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  ipcMain.removeHandler('sessioni:imposta-impostazioni');
  ipcMain.handle('sessioni:imposta-impostazioni', (_e, parte) => { salvate.push(parte); });
  win = new BrowserWindow({ show: false, focusable: false, width: 1152, height: 896, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'impostazioni', sezione: 'notifiche' } });
  await wait(() => !!document.querySelector('button[aria-label^="Silenzio"]'));

  await check('APRE con le ore di oggi e «del giorno dopo» (22:00 -> 7:00)', async () => {
    await apri();
    assert.equal(await run(() => document.querySelector('[role=dialog]').getAttribute('aria-label')), 'Quando non vuoi ricevere notifiche?');
    assert.deepEqual(await segmenti(), ['22', '00', '07', '00']);
    assert.ok(await run(() => document.querySelector('[role=dialog]').textContent.includes('del giorno dopo')));
    assert.equal(await run(() => document.activeElement.getAttribute('aria-label')), 'Dalle, ore', 'il fuoco parte sulle ore di «Dalle»');
  });

  await check('FRECCE: ore 23 -> 00 e minuti 59 -> 00 con il giro, frecce a schermo sul segmento col fuoco', async () => {
    await tasto('ArrowUp'); await tasto('ArrowUp');
    await wait(() => document.querySelector('[role=dialog] .segmento').textContent === '00');
    await tasto('ArrowDown');
    assert.deepEqual((await segmenti()).slice(0, 2), ['23', '00']);
    await fuoco(1); await tasto('ArrowDown');
    await wait(() => document.querySelectorAll('[role=dialog] .segmento')[1].textContent === '59');
    await tasto('ArrowUp');
    await wait(() => document.querySelectorAll('[role=dialog] .segmento')[1].textContent === '00');
    assert.equal((await segmenti())[0], '23', 'i minuti non toccano le ore');
    await fuoco(0);
    await run(() => document.querySelector('[role=dialog] button[aria-label="Aumenta dalle"]').click());
    await wait(() => document.querySelector('[role=dialog] .segmento').textContent === '00');
    await run(() => document.querySelector('[role=dialog] button[aria-label="Diminuisci dalle"]').click());
    await wait(() => document.querySelector('[role=dialog] .segmento').textContent === '23');
  });

  await check('NUMERI: due cifre e il fuoco passa avanti; sopra il massimo riparte dall\'ultima cifra', async () => {
    await fuoco(1); await tasto('5'); await tasto('9');
    assert.equal(await run(() => document.activeElement.getAttribute('aria-label')), 'Alle, ore');
    assert.deepEqual((await segmenti()).slice(0, 2), ['23', '59']);
    await tasto('9'); // 9 non può avere una seconda cifra: resta 09 e il fuoco passa ai minuti
    assert.equal((await segmenti())[2], '09');
    await fuoco(1); await tasto('0'); await tasto('0');
    assert.deepEqual(await segmenti(), ['23', '00', '09', '00']);
    await fuoco(2); await tasto('0'); await tasto('7');
    assert.deepEqual(await segmenti(), ['23', '00', '07', '00']);
  });

  await check('SALVA: «23:00–7:00» (ore senza zero, minuti a due cifre), il dialogo si chiude', async () => {
    await run(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Salva').click());
    await wait(() => !document.querySelector('[role=dialog]'));
    assert.deepEqual(salvate, [{ silenzio: '23:00–7:00' }]);
    await wait(() => document.body.innerText.includes('23:00–7:00'));
  });

  await check('INIZIO = FINE: errore, «Salva» spento, Invio non salva; con un orario diverso torna', async () => {
    salvate.length = 0;
    await apri();
    await fuoco(2); await tasto('2'); await tasto('3'); // Alle 23:00 = Dalle 23:00
    assert.ok(await run(() => document.querySelector('[role=dialog]').textContent.includes('Inizio e fine sono uguali. Scegli due orari diversi.')));
    assert.ok(await run(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Salva').disabled));
    assert.ok(!(await run(() => document.querySelector('[role=dialog]').textContent.includes('del giorno dopo'))));
    await fuoco(2); await tasto('Enter');
    assert.equal(await run(() => !!document.querySelector('[role=dialog]')), true);
    assert.deepEqual(salvate, []);
    await fuoco(3); await tasto('ArrowUp');
    await wait(() => ![...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Salva').disabled);
    await fuoco(2); await tasto('Enter');
    await wait(() => !document.querySelector('[role=dialog]'));
    assert.deepEqual(salvate, [{ silenzio: '23:00–23:01' }]);
  });

  console.log(`${risultati.filter(Boolean).length}/${risultati.length} prove ok`);
  app.exit(risultati.every(Boolean) ? 0 : 1);
});
