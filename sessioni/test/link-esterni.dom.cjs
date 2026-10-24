// BrowserWindow e clic reali; nessun browser o servizio esterno avviato.
const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { apriFinestra } = require('../dist/src/finestra.js');
const { urlWeb } = require('../dist/src/link-esterni.js');

// Impedisce anche l'attivazione dell'app di prova sul Mac, prima di ready.
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
let shown = 0;
app.on('browser-window-created', (_event, window) => window.on('show', () => shown++));

app.whenReady().then(async () => {
  let win;
  try {
    require('../dist/src/scena.js').collegaScena(ipcMain, require('../design/scene/101-14849.json'));
    const opened = [], errors = [], failedNavigations = [];
    let rejectOpen = false, children = 0;
    shell.openExternal = async (url) => {
      opened.push(url);
      if (rejectOpen) throw new Error('TEST_OPEN_REJECTED');
    };
    dialog.showMessageBox = async (...args) => { errors.push(args.at(-1)); return { response: 0 }; };
    win = apriFinestra(undefined, { show: false });
    assert.ok(win, 'pagina applicazione costruita');
    assert.equal(win.isVisible(), false, 'factory nascosta dalla costruzione');
    assert.equal(win.webContents.isAudioMuted(), true, 'audio di prova disattivato');
    win.webContents.on('did-create-window', () => children++);
    win.webContents.on('did-fail-load', (_e, code, description, url, main) => failedNavigations.push({ code, description, url, main }));
    await once(win.webContents, 'did-finish-load');
    const original = win.webContents.getURL();
    const run = (fn, ...args) => win.webContents.executeJavaScript(`(${fn})(...${JSON.stringify(args)})`);
    const settle = () => run(() => new Promise(r => setTimeout(r, 80)));
    const click = async (url, target = '') => {
      await run((url, target) => {
        const a = document.createElement('a'); a.href = url; a.target = target;
        a.textContent = 'Test link'; document.body.append(a); a.click(); a.remove();
      }, url, target);
      await settle();
    };
    const unchanged = () => {
      assert.equal(win.webContents.getURL().split('#')[0], original);
      assert.equal(children, 0, 'nessuna finestra figlia');
      assert.equal(BrowserWindow.getAllWindows().length, 1);
      assert.equal(win.isVisible(), false, 'app di prova sempre nascosta');
      assert.equal(win.webContents.isAudioMuted(), true, 'audio di prova sempre disattivato');
      assert.equal(shown, 0, 'nessuna finestra di prova mostrata');
    };

    // La stessa azione senza confine deve davvero intercettare una finestra figlia.
    const control = new BrowserWindow({ show: false });
    assert.equal(control.isVisible(), false);
    control.webContents.setWindowOpenHandler(() => ({ action: 'allow', overrideBrowserWindowOptions: { show: false } }));
    await control.loadURL('about:blank');
    const childCreated = once(control.webContents, 'did-create-window');
    await control.webContents.executeJavaScript("window.open('about:blank'); void 0");
    const [child] = await childCreated;
    assert.ok(child); assert.equal(child.isVisible(), false, 'popup positivo nascosto dalla costruzione');
    assert.equal(shown, 0); child.destroy(); control.destroy();
    console.log('EXTERNAL_POSITIVE_CONTROL: child-window rilevata');

    assert.equal(urlWeb('HTTPS://Example.COM:443/a b?q=1#c'), 'https://example.com/a%20b?q=1#c');
    for (const invalid of ['', 'example.com', 'http://', 'https://user:secret@example.com',
      'javascript:alert(1)', 'data:text/html,test', 'file:///tmp/a', 'mailto:a@b.it',
      'tel:123', 'vbscript:test', 'clotch://open', 'https://exa\nmple.com']) {
      assert.equal(urlWeb(invalid), null, invalid);
    }
    await click('https://EXAMPLE.com:443/docs?a=1#part');
    assert.deepEqual(opened, ['https://example.com/docs?a=1#part']); unchanged();
    await click('http://example.com/plain', '_blank');
    assert.equal(opened.at(-1), 'http://example.com/plain'); unchanged();
    await run(() => { window.open('https://example.com/popup'); }); await settle();
    assert.equal(opened.at(-1), 'https://example.com/popup'); unchanged();
    await run(() => { window.location.href = 'https://example.com/location'; }); await settle();
    assert.equal(opened.at(-1), 'https://example.com/location'); unchanged();
    console.log('EXTERNAL_WEB_LINKS: anchor, target blank, window.open, location OK');

    const count = opened.length;
    for (const invalid of ['file:///tmp/clotch-denied.html', 'data:text/html,denied',
      'javascript:void(0)', 'vbscript:test', 'mailto:a@b.it', 'tel:123', 'clotch://open',
      'https://user:secret@example.com']) {
      await click(invalid); await click(invalid, '_blank');
      await run((url) => { window.open(url); }, invalid); await settle();
      assert.equal(opened.length, count, invalid); unchanged();
    }
    console.log('EXTERNAL_DENY: file, data, javascript, vbscript, mailto, tel, custom, credentials OK');

    await click('#local-section');
    assert.equal(new URL(win.webContents.getURL()).hash, '#local-section');
    assert.equal(opened.length, count); unchanged();
    await run(() => {
      const iframe = document.createElement('iframe');
      iframe.id = 'test-frame'; iframe.src = 'about:blank'; document.body.append(iframe);
      const guest = document.createElement('webview');
      guest.src = 'https://example.com/guest'; document.body.append(guest);
    });
    await settle();
    await run(() => { document.getElementById('test-frame').contentWindow.location.href = 'https://example.com/subframe'; });
    await settle();
    assert.equal(opened.length, count, 'frame non apre browser'); unchanged();
    assert.equal(win.webContents.mainFrame.frames.length, 1, 'un solo iframe vuoto');
    assert.ok(failedNavigations.some(f => !f.main && f.url === 'https://example.com/subframe' && f.code !== 0),
      'documento iframe esterno bloccato dalla CSP prima del confine di navigazione');
    assert.equal(win.webContents.getLastWebPreferences().webviewTag, false);
    console.log('EXTERNAL_INTERNAL: ancora locale e blocco frame/webview OK');

    rejectOpen = true;
    await click('https://example.com/failure');
    assert.equal(errors.length, 1, 'errore di apertura visibile');
    assert.equal(errors[0].type, 'error');
    assert.match(errors[0].message, /non aperto/i); unchanged();
    console.log('EXTERNAL_FAILURE: callback apertura rifiutata e dialogo intercettato OK');
    assert.equal(shown, 0);
    console.log('EXTERNAL_HIDDEN_WINDOWS_OK: factory e popup mai mostrati');
    console.log('EXTERNAL_MUTED_AUDIO_OK: audio disattivato prima del caricamento');
    console.log('EXTERNAL_LINKS_OK'); app.exit(0);
  } catch (error) { console.error(error); win?.destroy(); app.exit(1); }
});
