// Renderer vero, registro fittizio: nessun dato o comando del Mac.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { collegaScena } = require(path.join(root, 'dist/src/scena.js'));
const positivo = '# Verifica delle sessioni\n\nHo controllato **tre percorsi** e il ritorno alle impostazioni.\n\nRiga uno  \nRiga due.\n\n- Chat della sessione\n- Risposta di clotch AI\n\n1. Apri impostazioni\n2. Torna alla chat\n\n[Apri la prova](https://example.com/prova) e `npm test`.\n\n| Percorso | Esito |\n| --- | --- |\n| Chat | Verificato |\n\n```sh\nnpm test\nprintf "ok"\n```\n\n> Le prove usano dati fittizi.\n\n- [x] Controllo terminato\n\n~~Vecchia nota~~';
const segreto = 'sk-test_abcdefghijklmnopqrstuvwxyz';
const avverso = `[male](javascript:alert%281%29) [data](data:text/html;base64,AAAA) [file](file:///etc/passwd) [relativo](../privato)\n\n<script>window.MARKDOWN_PWNED=1</script>\n\n<img src="x" onerror="window.MARKDOWN_PWNED=1">\n\n![immagine](https://example.com/track.png)\n\n[segreto](https://example.com/${segreto})\n\n\`\`\`txt\n${segreto}\n\`\`\``;
app.whenReady().then(async () => {
  collegaScena(ipcMain, { impostazioni: { nascondiChiavi: true }, registro: {
    avvisi: [positivo, avverso, '## Risposta parziale\n\n**Sto scrivendo\n\n```js\nconst x ='].map((testo, i) => ({ motivo: 'risposta', id: `markdown-${i}`, t: i + 1, testo, sessioni: [] })),
  } });
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000,
    webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
  const run = (fn) => win.webContents.executeJavaScript(`(${fn})()`);
  try {
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'friday' } });
    await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{ const end=Date.now()+5000; const tick=()=>document.querySelectorAll('.risposta').length===3?resolve():Date.now()>end?reject(Error('Risposte assenti')):setTimeout(tick,20);tick();})`);
    await run(() => { window.__markdownCopies = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__markdownCopies.push(text); } } }); });
    const state = await run(() => {
      const [ok, bad, partial] = document.querySelectorAll('.testo-risposta');
      return { heading: ok.querySelector('h1')?.textContent, list: ok.querySelectorAll('ul > li').length,
        ordered: ok.querySelectorAll('ol > li').length, table: ok.querySelector('table td')?.textContent,
        strong: ok.querySelector('strong')?.textContent, link: ok.querySelector('a')?.getAttribute('href'),
        code: ok.querySelector('pre code')?.textContent, quote: ok.querySelector('blockquote')?.textContent,
        task: ok.querySelector('input[type="checkbox"]')?.checked, strike: ok.querySelector('del')?.textContent,
        unsafeLinks: [...bad.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
        images: bad.querySelectorAll('img').length, script: bad.querySelectorAll('script').length,
        pwned: window.MARKDOWN_PWNED, html: bad.innerHTML, partial: partial.querySelector('pre code')?.textContent };
    });
    assert.equal(state.heading, 'Verifica delle sessioni');
    assert.equal(state.list, 3); assert.equal(state.ordered, 2);
    assert.equal(state.table, 'Chat'); assert.equal(state.strong, 'tre percorsi');
    assert.equal(state.link, 'https://example.com/prova');
    assert.equal(state.code, 'npm test\nprintf "ok"\n');
    assert.match(state.quote, /dati fittizi/); assert.equal(state.task, true); assert.equal(state.strike, 'Vecchia nota');
    assert.equal(state.images, 0); assert.equal(state.script, 0); assert.equal(state.pwned, undefined);
    assert.deepEqual(state.unsafeLinks, ['https://example.com/' + encodeURIComponent('••••')]);
    assert.equal(state.html.includes(segreto), false);
    assert.equal(state.partial, 'const x =\n');
    await run(() => document.querySelector('.markdown-codice button').click());
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(await run(() => window.__markdownCopies.at(-1)), 'npm test\nprintf "ok"');
    await run(() => document.querySelector('.risposta .azioni button[aria-label="Copia"]').click());
    await new Promise(resolve => setTimeout(resolve, 80));
    const plain = await run(() => window.__markdownCopies.at(-1));
    assert.match(plain, /Verifica delle sessioni/); assert.match(plain, /tre percorsi/);
    assert.match(plain, /Riga uno\nRiga due/);
    assert.match(plain, /Apri la prova/); assert.match(plain, /Chat/); assert.match(plain, /npm test/);
    assert.doesNotMatch(plain, /\*\*|```|\]\(https|^# /m);
    await run(() => document.querySelector('.risposta .azioni button[aria-label="Altro"]').click());
    await run(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Copia come Markdown').click());
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(await run(() => window.__markdownCopies.at(-1)), positivo);
    await run(() => document.querySelectorAll('.risposta')[1].querySelector('.azioni button[aria-label="Copia"]').click());
    await new Promise(resolve => setTimeout(resolve, 80));
    const maskedCopy = await run(() => window.__markdownCopies.at(-1));
    assert.equal(maskedCopy.includes(segreto), false); assert.match(maskedCopy, /••••/);
    console.log('MARKDOWN_SEMANTICS heading/list/link/table/code/task/quote: OK');
    console.log('MARKDOWN_SECURITY protocols/raw-html/images/secrets/partial: OK');
    console.log('MARKDOWN_COPY code/plain/markdown: OK');
    require('node:fs').writeFileSync('/tmp/clotch-440-markdown.png', (await win.webContents.capturePage()).toPNG());
    console.log('MARKDOWN_RENDER_OK');
    app.exit(0);
  } catch (e) { console.error(e); app.exit(1); }
});
