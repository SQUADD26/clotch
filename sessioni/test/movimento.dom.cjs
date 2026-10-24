// Movimento (#520): ogni cosa animata, misurata fotogramma per fotogramma con document.getAnimations() e requestAnimationFrame.
// Durata e curva devono essere quelle dei token (tempo/*, curva/*); con «riduci movimento» niente spostamenti né infinite.
// Finestra visibile sotto xvfb (una finestra nascosta salta le View Transition), muta. Stampa una riga «MOV …» per misura.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const scene = require(path.join(root, 'design/scene/101-8036.json'));

// Nel renderer: registra le animazioni nuove e gli intervalli tra fotogrammi per `ms`, dopo aver lanciato `fai`.
const REGISTRA = `window.registra = (fai, ms) => new Promise((fine) => {
  const viste = new Map(), passi = [];
  const t0 = performance.now(); let prima = t0;
  const tick = (t) => {
    passi.push(t - prima); prima = t;
    for (const a of document.getAnimations()) if (!viste.has(a)) {
      const tempi = a.effect.getTiming(), chiavi = a.effect.getKeyframes();
      viste.set(a, { nome: a.animationName ?? a.transitionProperty, pseudo: a.effect.pseudoElement ?? '', classe: String(a.effect.target?.className ?? ''),
        durata: tempi.duration, curva: tempi.easing !== 'linear' ? tempi.easing : (chiavi[0]?.easing ?? 'linear'), giri: tempi.iterations });
    }
    if (t - t0 < ms) requestAnimationFrame(tick); else fine({ animazioni: [...viste.values()], passi: passi.slice(1) });
  };
  requestAnimationFrame(tick); fai();
});`;

app.whenReady().then(async () => {
  collegaScena(ipcMain, scene);
  const win = new BrowserWindow({ show: true, focusable: false, width: 1440, height: 900,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true, backgroundThrottling: false } });
  const run = (fn) => win.webContents.executeJavaScript(typeof fn === 'string' ? fn : `(${fn})()`);
  const wait = async (test, ms = 8000) => { const fine = Date.now() + ms; while (!(await run(test))) { if (Date.now() > fine) throw new Error('Condizione UI non raggiunta: ' + test); await new Promise((r) => setTimeout(r, 20)); } };
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'));
    await wait(() => !!document.querySelector('.barra-laterale .riga') && !document.hidden);
    await run(REGISTRA + ";0");
    const tok = await run(() => Object.fromEntries(['tempo-entrata', 'tempo-uscita', 'tempo-pressione', 'tempo-spostamento', 'curva-entrata', 'curva-uscita', 'curva-spostamento', 'scala-premuto']
      .map((n) => [n, getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim()])));
    const ms = (x) => (x.endsWith('ms') ? parseFloat(x) : Math.round(parseFloat(x) * 1000)), curva = (x) => x.replace(/\s+/g, '').replace(/([(,])0\./g, '$1.');
    const misura = async (id, cosa, fai, attese, durata = 400) => {
      const r = await run(`window.registra(${fai}, ${durata})`);
      const persi = r.passi.filter((p) => p > 1000 / 60 * 1.5).length;
      const mediana = r.passi.slice().sort((a, b) => a - b)[Math.floor(r.passi.length / 2)] ?? 0;
      for (const [pseudo, tempo, curvaTok] of attese) {
        const a = r.animazioni.find((x) => x.pseudo === pseudo || (pseudo.startsWith('.') && String(x.classe).includes(pseudo.slice(1))));
        assert.ok(a, `${id}: manca l'animazione ${pseudo} (viste: ${r.animazioni.map((x) => x.pseudo || x.nome).join(', ')})`);
        console.log(`MOV ${id} ${cosa} ${pseudo} durata=${a.durata}ms curva=${curva(a.curva)} fotogrammi=${r.passi.length} persi=${persi} lenti=[${r.passi.filter((p) => p > 25).map((p) => p.toFixed(0))}] mediana=${mediana.toFixed(1)}ms`);
        assert.equal(a.durata, ms(tok[tempo]), `${id} ${pseudo}: durata`);
        assert.equal(curva(a.curva), curva(tok[curvaTok]), `${id} ${pseudo}: curva`);
      }
      assert.ok(mediana < 34, `${id}: mediana dei fotogrammi ${mediana} ms (sotto 30 fps)`);
      return r;
    };
    const clic = (sel) => `() => document.querySelector('${sel}').click()`;
    const E = ['tempo-entrata', 'curva-entrata'], U = ['tempo-uscita', 'curva-uscita'], S = ['tempo-spostamento', 'curva-spostamento'];

    // riferimento: la stessa finestra ferma, per separare i fotogrammi lenti di xvfb da quelli delle animazioni
    const fermo = await run('window.registra(() => {}, 400)');
    console.log(`MOV riposo fotogrammi=${fermo.passi.length} persi=${fermo.passi.filter((p) => p > 25).length}`);
    // barra laterale accanto alla colonna: chiudi (uscita) e apri (entrata), la superficie si allarga senza scatto
    await misura('MOV-001', 'barra chiusa', clic('button[aria-label="Barra laterale"]'), [['::view-transition-old(barra)', ...U], ['::view-transition-group(superficie)', ...S]]);
    await wait(() => !document.querySelector('.barra-laterale'));
    await misura('MOV-002', 'barra aperta', clic('button[aria-label="Barra laterale"]'), [['::view-transition-new(barra)', ...E]]);
    await wait(() => !!document.querySelector('.barra-laterale .riga'));
    // pannello: il bottone gira obiettivo -> info -> chiuso
    const pannello = clic('button[aria-label="Pannello"]');
    const statoPannello = () => run(() => !!document.querySelector('.pannello'));
    while (!(await statoPannello())) await run(`(${pannello})()`), await new Promise((r) => setTimeout(r, 300));
    await misura('MOV-003', 'pannello info', pannello, [['::view-transition-group(pannello)', ...S]]);
    await misura('MOV-004', 'pannello chiuso', pannello, [['::view-transition-old(pannello)', ...U]]);
    await misura('MOV-005', 'pannello aperto', pannello, [['::view-transition-new(pannello)', ...E]]);
    // righe: la cartella si chiude (le sue righe escono) e si riapre (entrano)
    await misura('MOV-007', 'cartella chiusa', clic('.pezzo-barra button.riga[aria-expanded="true"]'), [['::view-transition-new(barra)', ...E], ['::view-transition-old(barra)', ...E]]);
    await misura('MOV-008', 'cartella aperta', clic('.pezzo-barra button.riga[aria-expanded="false"]'), [['::view-transition-new(barra)', ...E], ['::view-transition-old(barra)', ...E]]);
    // passaggio tra viste: «Nuova sessione», poi di nuovo la sessione
    await misura('MOV-006', 'vista nuova sessione', `() => [...document.querySelectorAll('.pezzo-barra .riga')].find((r) => r.textContent.startsWith('Nuova sessione')).click()`, [['::view-transition-new(superficie)', ...E], ['::view-transition-old(superficie)', ...E]]);
    await misura('MOV-006', 'vista sessione', `() => document.querySelector('.riga-sessione').click()`, [['::view-transition-new(superficie)', ...E]]);
    // blocchi del filo (strumenti, pensiero, modifiche): si aprono e si chiudono con dissolvenza della superficie
    await wait(() => !!document.querySelector('.pezzo-chat .testata[aria-expanded="false"]'));
    await misura('MOV-017', 'blocco del filo aperto', clic('.pezzo-chat .testata[aria-expanded="false"]'), [['::view-transition-new(superficie)', ...E], ['::view-transition-old(superficie)', ...E]]);
    await misura('MOV-017', 'blocco del filo chiuso', clic('.pezzo-chat .testata[aria-expanded="true"]'), [['::view-transition-new(superficie)', ...E]]);
    // avviso: «Nascondi cartella» dal menu della cartella, poi chiuso dalla sua X
    await run(() => document.querySelector('.pezzo-barra button.riga[aria-expanded]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 200 })));
    await wait(() => [...document.querySelectorAll('[role="menuitem"], .voce')].some((v) => v.textContent.includes('Nascondi cartella')));
    const r = await misura('MOV-009', 'avviso entra', `() => [...document.querySelectorAll('[role="menuitem"], .voce')].find((v) => v.textContent.includes('Nascondi cartella')).click()`, [], 400);
    const avviso = r.animazioni.find((a) => /view-transition-new\(avviso-\d+\)/.test(a.pseudo));
    assert.ok(avviso, 'MOV-009: l\'avviso entra con la sua transizione');
    console.log(`MOV MOV-009 avviso entra ${avviso.pseudo} durata=${avviso.durata}ms curva=${curva(avviso.curva)}`);
    assert.equal(avviso.durata, ms(tok['tempo-entrata'])); assert.equal(curva(avviso.curva), curva(tok['curva-entrata']));
    const r2 = await misura('MOV-010', 'avviso esce', `() => document.querySelector('.avviso-comparsa button[aria-label="Chiudi"]').click()`, [], 400);
    const esce = r2.animazioni.find((a) => /view-transition-old\(avviso-\d+\)/.test(a.pseudo));
    assert.ok(esce, 'MOV-010: l\'avviso esce con la sua transizione');
    console.log(`MOV MOV-010 avviso esce ${esce.pseudo} durata=${esce.durata}ms curva=${curva(esce.curva)}`);
    assert.equal(esce.durata, ms(tok['tempo-uscita'])); assert.equal(curva(esce.curva), curva(tok['curva-uscita']));
    await run(() => [...document.querySelectorAll('.avviso-comparsa button')].find((b) => b.textContent === 'Annulla')?.click());

    // pressione: un bottone icona premuto scende a scala-premuto in tempo-pressione
    const c = await run(() => { const r = document.querySelector('button[aria-label="Barra laterale"]').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; });
    const transizione = await run(() => getComputedStyle(document.querySelector('button[aria-label="Barra laterale"]')).transitionDuration);
    win.webContents.sendInputEvent({ type: 'mouseDown', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 200));
    const premuto = await run(() => getComputedStyle(document.querySelector('button[aria-label="Barra laterale"]')).transform);
    win.webContents.sendInputEvent({ type: 'mouseUp', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    console.log(`MOV MOV-011 pressione bottone transform=${premuto} transizione=${transizione}`);
    const s = parseFloat(tok["scala-premuto"]); assert.equal(premuto, `matrix(${s}, 0, 0, ${s}, 0, 0)`);
    assert.ok(transizione.split(',').every((d) => parseFloat(d) * 1000 === ms(tok['tempo-pressione'])), 'pressione in tempo-pressione');
    await new Promise((r) => setTimeout(r, 400)); // il clic vero ha chiuso la barra: la si riapre
    if (!(await run(() => !!document.querySelector('.barra-laterale')))) await run(`(${clic('button[aria-label="Barra laterale"]')})()`);
    await wait(() => !!document.querySelector('.barra-laterale .riga'));

    // finestra stretta: barra sopra con il velo
    win.setSize(700, 900);
    await wait(() => innerWidth === 700 && (!document.querySelector('.barra-laterale') || !!document.querySelector('.barra-laterale.sopra')));
    await new Promise((r) => setTimeout(r, 400));
    if (await run(() => !!document.querySelector('.velo-barra'))) await run(`(${clic('.velo-barra')})()`), await wait(() => !document.querySelector('.velo-barra'));
    await misura('MOV-012', 'barra sopra apre', clic('button[aria-label="Barra laterale"]'), [['::view-transition-new(barra)', ...E], ['::view-transition-new(velo)', ...E]]);
    await misura('MOV-013', 'barra sopra chiude', clic('.velo-barra'), [['::view-transition-old(barra)', ...U], ['::view-transition-old(velo)', ...U]]);

    // riduci movimento: niente gruppi che si spostano, niente scale né infinite
    // controllo positivo: uno spinner gira (infinito, tempo-giro) finché il movimento non è ridotto
    await run(() => { document.body.append(Object.assign(document.createElement('span'), { className: 'gira prova-gira' })); return 0; });
    const giri = await run(() => document.getAnimations().filter((a) => a.effect.getTiming().iterations === Infinity).length);
    assert.ok(giri >= 1, 'lo spinner gira a movimento pieno');
    win.webContents.debugger.attach();
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const rr = await run(`window.registra(${clic('button[aria-label="Barra laterale"]')}, 400)`);
    const gruppi = rr.animazioni.filter((a) => a.pseudo.startsWith('::view-transition-group'));
    const infinite = await run(() => document.getAnimations().filter((a) => a.effect.getTiming().iterations === Infinity).length);
    const scivola = await run(() => getComputedStyle(document.documentElement).getPropertyValue('--scivola-barra').trim());
    console.log(`MOV ridotto infinite_prima=${giri} gruppi=${gruppi.length} infinite=${infinite} scivola=${scivola} animazioni=${rr.animazioni.map((a) => a.pseudo || a.nome).join(',')}`);
    assert.equal(gruppi.length, 0); assert.equal(infinite, 0); assert.equal(scivola, '0%');
    console.log('MOVIMENTO_OK');
  } catch (e) { console.error(e); process.exitCode = 1; }
  app.quit();
});
