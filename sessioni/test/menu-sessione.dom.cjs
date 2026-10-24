// Menu della sessione e della cartella (#722 #719 #718 #723 #740 #720): voci che seguono lo stato, voci spente, esito visibile,
// ancora al bottone, tastiera (Tab, lettera, Home/End), chiusura allo scorrimento, «Archivia tutte» con «Annulla».
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
scene.elenco.sessioni = ['a', 'b', 'c'].map((id) => ({ ...scene.elenco.sessioni[0], id, titolo: `Sessione ${id}`, cartella: CARTELLA, idApp: id === 'c' ? null : 'local_' + id }));
scene.messaggi = { a: [], b: [], c: [] };
scene.cartelle = [{ percorso: '~/.claude-uno', dettaglio: '3 sessioni · letta ora', errore: false }, { percorso: '~/.claude-due', dettaglio: '1 sessione · letta ora', errore: false }];
let win;
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

const finto = { pref: {}, azioni: [], comandi: [], rifiuta: null };
app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  for (const c of ['sessioni:preferenze', 'sessioni:imposta-preferenze', 'sessioni:azione', 'clotch-ai:comando']) ipcMain.removeHandler(c);
  ipcMain.handle('sessioni:preferenze', () => finto.pref);
  ipcMain.handle('sessioni:imposta-preferenze', (e, id, parte) => {
    const n = { ...finto.pref[id], ...parte };
    for (const k of Object.keys(n)) if (n[k] == null) delete n[k];
    if (Object.keys(n).length) finto.pref[id] = n; else delete finto.pref[id];
    e.sender.send('sessioni:preferenze', finto.pref);
  });
  ipcMain.handle('sessioni:azione', (_e, id, a) => { finto.azioni.push([id, a]); if (finto.rifiuta) throw new Error(finto.rifiuta); });
  ipcMain.handle('clotch-ai:comando', (_e, cmd, args) => { finto.comandi.push([cmd, args.chat]); return { id: 'x', esito: 'ok', testo: '' }; });
  win = new BrowserWindow({ show: false, focusable: false, width: 1440, height: 900, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  await carica({ vista: 'sessione', sessione: 'a' });
  const tasto = (k, o = {}) => run((k, o) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }); (document.activeElement || document.body).dispatchEvent(e); }, k, o);
  const fuoco = () => run(() => document.activeElement?.textContent?.trim());
  const apri = async (testo) => { await menuDi('.riga-sessione', testo); await wait(() => document.activeElement?.matches('[role=menu] .voce')); };

  await check('STATO: «Fissa in alto» e «Segna come non letta» cambiano etichetta e si disfano', async () => {
    await apri('Sessione b');
    assert.ok((await voci()).includes('Fissa in alto') && (await voci()).includes('Segna come non letta'));
    await clicca('[role=menu] .voce', 'Segna come non letta');
    await wait(() => true);
    await apri('Sessione b');
    assert.ok((await voci()).includes('Segna come letta'), (await voci()).join('|'));
    await clicca('[role=menu] .voce', 'Segna come letta');
    await attendi(() => !finto.pref.b);
  });

  await check('SPENTE: senza idApp «Copia link» è spenta, non si clicca e le frecce la saltano', async () => {
    await apri('Sessione c');
    const d = await run(() => { const b = [...document.querySelectorAll('[role=menu] .voce')].find((x) => x.textContent.includes('Copia link')); return { dis: b.disabled, t: b.title, col: getComputedStyle(b.querySelector('.etichetta')).color }; });
    assert.equal(d.dis, true); assert.ok(d.t.length > 5); assert.notEqual(d.col, await run(() => getComputedStyle(document.querySelector('[role=menu] .etichetta')).color));
    await tasto('End'); assert.equal(await fuoco(), 'Mostra nel Finder');
    await tasto('ArrowUp'); assert.equal(await fuoco(), 'Copia cartella di lavoro');
    await tasto('Escape');
  });

  await check('TASTIERA: lettera salta alla voce, Home/End, Tab chiude il menu', async () => {
    await apri('Sessione c');
    await tasto('c'); assert.equal(await fuoco(), 'Copia ID sessione');
    await tasto('c'); assert.equal(await fuoco(), 'Copia cartella di lavoro');
    await tasto('Home'); assert.equal(await fuoco(), 'Fissa in alto');
    await tasto('End'); assert.equal(await fuoco(), 'Mostra nel Finder');
    await tasto('Tab');
    await wait(() => !document.querySelector('[role=menu]'));
  });

  await check('ESITO: copia dice «ID copiato», un errore del main diventa avviso rosso', async () => {
    await apri('Sessione b'); await clicca('[role=menu] .voce', 'Copia ID sessione');
    await wait(() => document.body.innerText.includes('ID copiato'));
    finto.rifiuta = 'nessun link';
    await apri('Sessione b'); await clicca('[role=menu] .voce', 'Mostra nel Finder');
    await wait(() => document.body.innerText.includes('nessun link'));
    finto.rifiuta = null;
  });

  await check('ESITO: Archivia dice «Sessione archiviata» e Annulla la ripristina', async () => {
    await apri('Sessione b'); await clicca('[role=menu] .voce', 'Archivia⇧⌘A');
    await wait(() => document.body.innerText.includes('Sessione archiviata'));
    assert.deepEqual(finto.comandi.at(-1), ['archivia', 'b']);
    await clicca('button', 'Annulla');
    await attendi(() => finto.comandi.at(-1)[0] === 'ripristina');
  });

  await check('ANCORA: il «⋯» apre il menu sotto il bottone, non sul puntatore; scorrere chiude', async () => {
    await run(() => { const r = [...document.querySelectorAll('.riga-sessione')].find((e) => e.textContent.includes('Sessione b')); r.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); r.querySelector('button[aria-label="Altre azioni"]').click(); });
    await wait(() => !!document.querySelector('[role=menu]'));
    const m = await run(() => { const b = document.querySelector('button[aria-label="Altre azioni"][aria-expanded=true]') ?? document.querySelector('button[aria-label="Altre azioni"]'); const r = b.getBoundingClientRect(), q = document.querySelector('[role=menu]').getBoundingClientRect(); return { top: q.top, bottom: r.bottom, left: q.left, bl: r.left }; });
    assert.ok(m.top >= m.bottom, JSON.stringify(m));
    await run(() => { document.querySelector('.elenco').dispatchEvent(new Event('scroll')); });
    await wait(() => !document.querySelector('[role=menu]'));
  });

  await check('CARTELLA: «Archivia tutte» archivia tutte con un solo avviso «Annulla»', async () => {
    finto.comandi.length = 0;
    await menuDi('button[aria-expanded]', 'clotch');
    await wait(() => !!document.querySelector('[role=menu]'));
    await clicca('[role=menu] .voce', 'Archivia tutte le sessioni');
    await wait(() => document.body.innerText.includes('3 sessioni archiviate'));
    assert.equal(finto.comandi.filter((c) => c[0] === 'archivia').length, 3);
    await clicca('button', 'Annulla');
    await attendi(() => finto.comandi.filter((c) => c[0] === 'ripristina').length === 3);
  });

  await check('LIVELLI: a finestra stretta il primo Esc chiude solo il menu, il secondo la barra (#759)', async () => {
    win.setSize(480, 768);
    await wait(() => !document.querySelector('.barra-laterale'));
    await run(() => document.querySelector('button[aria-label="Barra laterale"]').click());
    await wait(() => !!document.querySelector('.barra-laterale.sopra'));
    await apri('Sessione b');
    await tasto('Escape');
    await wait(() => !document.querySelector('[role=menu]'));
    assert.ok(await run(() => !!document.querySelector('.barra-laterale.sopra')), 'la barra è rimasta');
    await tasto('Escape');
    await wait(() => !document.querySelector('.barra-laterale'));
  });

  console.log(`MENU_SESSIONE_RIEPILOGO ok=${risultati.filter(Boolean).length} fail=${risultati.filter((x) => !x).length}`);
  app.exit(risultati.every(Boolean) ? 0 : 1);
}).catch((e) => { console.error(e); app.exit(1); });
