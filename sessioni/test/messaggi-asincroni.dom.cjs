// Hook reale React/Electron, snapshot v1 e IPC differito: nessun dato o comando reale.
const { app, BrowserWindow, ipcMain } = require('electron');
process.env.CLOTCH_TEST_SILENT = '1';
app.commandLine.appendSwitch('mute-audio');
app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { creaCronologiaScena } = require('../dist/src/scena-cronologia.js');
const temp = fs.mkdtempSync(path.join(root, '.async-chat-'));
const user = (testo) => ({ tipo: 'utente', testo, t: null });
const sources = { A: [user('A tardiva')], B: [user('B precedente'), user('B recente')], C: [user('C recente')] };
const fixture = creaCronologiaScena((id) => sources[id] ?? [], 1);
const pending = [], scripted = [];
let win, duringCapture;
const emit = (d) => win.webContents.send('sessioni:aggiornamento', { sessioni: [], nuoviMessaggi: [], cronologia: [d] });
ipcMain.handle('sessioni:messaggi', (_event, id, pagina, opzioni) => {
  assert.equal(opzioni?.v, 1, 'hook sempre v1, nessun fallback numerico');
  if (pagina === 0 && scripted.length) sources[id] = scripted.shift().map(user);
  const result = fixture.pagina(id, pagina, opzioni);
  if (duringCapture) { const f = duringCapture; duringCapture = null; f(result); }
  return new Promise((resolve) => pending.push({ id, pagina, opzioni, result, resolve }));
});
const wait = async (fn, label) => {
  const end = Date.now() + 5000;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error('Timeout: ' + label);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
app.whenReady().then(async () => {
  try {
    const entry = path.join(temp, 'entry.jsx');
    fs.writeFileSync(entry, `import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { useMessaggi } from '../src/ui/base/dati.ts';
      let current = 'A'; const root = createRoot(document.getElementById('root'));
      function Probe() { const m = useMessaggi(current); window.probe = m;
        return React.createElement('pre', null, JSON.stringify(m)); }
      window.mount = (id) => { current = id; root.render(React.createElement(Probe)); };
      window.settings = () => root.render(React.createElement('p', null, 'settings'));
      window.mount('A');`);
    const { build } = await import('vite');
    await build({ root, configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, build: { outDir: path.join(temp, 'out'),
      lib: { entry, name: 'Probe', formats: ['iife'], fileName: () => 'probe.js' } } });
    fs.writeFileSync(path.join(temp, 'index.html'), '<div id="root"></div><script src="out/probe.js"></script>');
    win = new BrowserWindow({ show: false, focusable: false, webPreferences: { preload: path.join(root, 'dist/src/preload.js'), contextIsolation: true } });
    let showEvents = 0, focusEvents = 0;
    win.on('show', () => showEvents++);
    win.on('focus', () => focusEvents++);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const hidden = () => {
      assert.equal(win.isVisible(), false, 'finestra mai visibile');
      assert.equal(win.isFocused(), false, 'finestra mai attiva');
      assert.equal(win.webContents.isAudioMuted(), true, 'audio renderer sempre muto');
      assert.equal(showEvents, 0, 'nessun evento show');
      assert.equal(focusEvents, 0, 'nessun evento focus');
    };
    hidden();
    win.webContents.on('console-message', (details) => { if (details.level === 'error') console.error(details.message); });
    const run = (code) => win.webContents.executeJavaScript(code);
    const requests = (n) => wait(() => pending.length >= n, n + ' richieste IPC');
    const text = () => run('probe.messaggi.map(m => m.testo ?? m.esito?.testo ?? m.tipo).join("|")');
    const settle = async (request, result = request.result) => { request.resolve(result); await run('new Promise(r => setTimeout(r, 30))'); };
    const queue = (...texts) => scripted.push(...texts);
    const fetch = async (id, messages) => {
      sources[id] = messages; const n = pending.length;
      await run(`mount(${JSON.stringify(id)})`); await requests(n + 1); return pending[n];
    };
    const previous = async (retry = false) => {
      const n = pending.length; await run(`void probe.${retry ? 'riprovaAltri' : 'altri'}()`); await requests(n + 1); return pending[n];
    };
    const failure = (r, codice, testo, ripartenza) => ({ ...r.result, cronologia: undefined, errore: testo,
      erroreCronologia: { codice, testo, ripartenza } });
    await win.loadFile(path.join(temp, 'index.html'));
    await requests(1);
    await run('mount("B")'); await requests(2);
    await settle(pending[1]); await settle(pending[0]);
    assert.equal(await text(), 'B recente', 'A lenta non può sostituire B');
    console.log('ASYNC_SWITCH_OK');
    await run('probe.altri(); probe.altri(); probe.altri();'); await requests(3);
    assert.equal(pending.length, 3, 'richieste equivalenti coalescenti nello stesso giro');
    assert.equal(pending[2].pagina, 1); assert.ok(pending[2].opzioni.cursore);
    await run('mount("C")'); await requests(4);
    await settle(pending[3]); await settle(pending[2]);
    assert.equal(await text(), 'C recente', 'pagina precedente tardiva isolata');
    console.log('ASYNC_PREVIOUS_AND_COALESCING_OK');
    queue(['C vecchio'], ['C nuovo']);
    await run('probe.riprova(); probe.riprova()'); await requests(6);
    await settle(pending[5]); await settle(pending[4]);
    assert.equal(await text(), 'C nuovo'); console.log('ASYNC_REFRESH_GENERATION_OK');
    queue(['C smontata']); await run('probe.riprova()'); await requests(7);
    queue(['C riaperta']); await run('settings()'); await run('mount("C")'); await requests(8);
    await settle(pending[7]); await settle(pending[6]);
    assert.equal(await text(), 'C riaperta'); console.log('ASYNC_REMOUNT_OK');
    queue(['C precedente', 'C recente']); await run('probe.riprova()'); await requests(9);
    await settle(pending[8]); await run('void probe.altri()'); await requests(10);
    queue(['D precedente', 'D recente']); await run('mount("D")'); await requests(11);
    await settle(pending[10]); await run('void probe.altri()'); await requests(12);
    await settle(pending[9], failure(pending[9], 'non_letta', 'errore precedente', 'stessa_pagina'));
    assert.equal(await run('probe.altriCarica'), true, 'finally vecchio non sblocca richiesta nuova');
    assert.equal(await run('probe.stato'), 'pronto');
    await run('void probe.altri()'); assert.equal(pending.length, 12);
    await settle(pending[11]); assert.equal(await text(), 'D precedente|D recente');
    assert.equal(await run('probe.altriCarica'), false); console.log('ASYNC_OLD_FINALLY_OK');
    await run('probe.riprova()'); await requests(13);
    await settle(pending[12], failure(pending[12], 'non_letta', 'messaggi non disponibili', 'stessa_pagina'));
    assert.equal(await run('probe.stato'), 'errore'); assert.equal(await run('probe.errore'), 'messaggi non disponibili');
    queue(['D ripresa']); await run('probe.riprova()'); await requests(14); await settle(pending[13]);
    assert.equal(await text(), 'D ripresa'); console.log('ASYNC_ERROR_RETRY_OK');

    // L'evento parte nel main prima della risposta IPC: il listener del vero hook deve già esistere.
    let initialDelta;
    duringCapture = (p) => {
      initialDelta = { tipo: 'upsert', sessione: 'Live', epoca: p.cronologia.epoca, daSeq: 1, aSeq: 2, totale: 3,
        righe: [1, 2].map((ordine) => ({ chiave: `fixture:Live:${ordine}`, ordine, revisione: 2, messaggio: user('uguale') })) };
      emit(initialDelta);
    };
    const live = await fetch('Live', [user('uguale')]);
    await settle(live);
    assert.equal(await text(), 'uguale|uguale|uguale');
    assert.equal(await run('new Set(probe.identita.map(r=>r.chiave)).size'), 3);
    assert.equal(await run('probe.totale'), 3);
    emit(initialDelta); emit({ ...initialDelta, sessione: 'Other', epoca: 'fixture:Other' });
    await run('new Promise(r=>setTimeout(r,30))'); assert.equal(await text(), 'uguale|uguale|uguale');
    console.log('ASYNC_V1_INITIAL_BUFFER_DUPLICATE_TEXT_AND_FOREIGN_SESSION_OK');

    const tool = { tipo: 'strumento', id: 'tool-native', nome: 'Bash', ingresso: { command: 'pwd' }, esito: null, t: null };
    const tr = await fetch('Tool', [tool, user('Dopo strumento')]); await settle(tr);
    assert.equal(await run('probe.messaggi.length'), 1);
    const toolDelta = { tipo: 'upsert', sessione: 'Tool', epoca: tr.result.cronologia.epoca, daSeq: 1, aSeq: 2, totale: 2,
      righe: [{ chiave: 'fixture:Tool:0', ordine: 0, revisione: 2, messaggio: { ...tool, esito: { testo: 'Risultato pronto', errore: false } } }] };
    emit(toolDelta); await run('new Promise(r=>setTimeout(r,30))');
    assert.equal(await run('probe.messaggi.length'), 1, 'tool fuori pagina rimane overlay, non appare anticipato');
    const oldToolPage = await previous(); await settle(oldToolPage);
    assert.equal(await text(), 'Risultato pronto|Dopo strumento');
    assert.equal(await run('probe.identita[0].revisione'), 2);
    assert.equal(await run('probe.totale'), 2);
    emit(toolDelta); await run('new Promise(r=>setTimeout(r,30))'); assert.equal(await run('probe.messaggi.length'), 2);
    console.log('ASYNC_V1_TOOL_OVERLAY_PREVIOUS_PAGE_OK');

    const pr = await fetch('Pages', [user('Prima'), user('Seconda'), user('Terza')]); await settle(pr);
    const failedPage = await previous();
    await settle(failedPage, failure(failedPage, 'non_letta', 'Pagina temporaneamente non letta', 'stessa_pagina'));
    assert.equal(await text(), 'Terza'); assert.equal(await run('probe.stato'), 'pronto');
    assert.equal(await run('probe.altriErrore'), 'Pagina temporaneamente non letta');
    const retryPage = await previous(true); assert.equal(retryPage.opzioni.cursore, failedPage.opzioni.cursore);
    await settle(retryPage); assert.equal(await text(), 'Seconda|Terza');
    const expired = await previous(); await settle(expired, failure(expired, 'snapshot_scaduta', 'Snapshot scaduta', 'nuova_snapshot'));
    assert.equal(await text(), 'Seconda|Terza'); assert.equal(await run('probe.haAltre'), false);
    sources.Pages = [user('Riletta')]; const beforeRetry = pending.length;
    await run('void probe.riprovaAltri()'); await requests(beforeRetry + 1);
    assert.equal(pending[beforeRetry].pagina, 0); assert.equal(pending[beforeRetry].opzioni.cursore, undefined);
    await settle(pending[beforeRetry]); assert.equal(await text(), 'Riletta');
    console.log('ASYNC_V1_PREVIOUS_ERROR_CURSOR_RETRY_AND_EXPIRY_OK');

    const gr = await fetch('Gap', [user('Conservato')]); await settle(gr);
    emit({ tipo: 'upsert', sessione: 'Gap', epoca: gr.result.cronologia.epoca, daSeq: 4, aSeq: 5, totale: 2,
      righe: [{ chiave: 'fixture:Gap:1', ordine: 1, revisione: 5, messaggio: user('Non applicare') }] });
    await wait(async () => await run('probe.stato') === 'errore', 'gap visibile');
    assert.equal(await text(), 'Conservato'); assert.match(await run('probe.errore'), /Aggiornamenti persi/);
    sources.Gap = [user('Risincronizzata')]; let n = pending.length;
    await run('probe.riprova()'); await requests(n + 1); await settle(pending[n]); assert.equal(await text(), 'Risincronizzata');
    assert.equal(await run('probe.stato'), 'pronto'); console.log('ASYNC_V1_GAP_RECOVERY_OK');

    const rr = await fetch('Reset', [user('Vecchia pagina'), user('Vecchia coda')]); await settle(rr);
    const obsolete = await previous();
    sources.Reset = [user('Nuova epoca')]; n = pending.length;
    emit({ tipo: 'reset', sessione: 'Reset', epocaPrecedente: rr.result.cronologia.epoca, epoca: 'reset-epoch', motivo: 'truncate' });
    await requests(n + 1); // #482: l'istantanea non vale più, il hook riparte da solo con una nuova
    assert.equal(pending[n].pagina, 0); assert.equal(pending[n].opzioni.cursore, undefined);
    assert.equal(await text(), 'Vecchia coda', 'durante la ripartenza restano le righe in vista');
    assert.equal(await run('probe.errore'), null);
    const fresh = pending[n].result;
    fresh.cronologia.epoca = 'reset-epoch'; fresh.cronologia.righe[0].chiave = 'reset-epoch:0';
    await settle(pending[n]); await settle(obsolete);
    assert.equal(await text(), 'Nuova epoca'); assert.equal(await run('probe.identita[0].chiave'), 'reset-epoch:0');
    assert.equal(await run('probe.errore'), null); assert.equal(await run('probe.stato'), 'pronto');
    assert.equal(await run('probe.altriCarica'), false); console.log('ASYNC_V1_RESET_AUTO_RESTART_OK');
    // se anche la ripartenza fallisce l'avviso resta, senza altre ripartenze
    n = pending.length;
    emit({ tipo: 'reset', sessione: 'Reset', epocaPrecedente: 'reset-epoch', epoca: 'reset-epoch-2', motivo: 'replace' });
    await requests(n + 1);
    await settle(pending[n], failure(pending[n], 'non_letta', 'Trascrizione non letta', 'stessa_pagina'));
    assert.equal(await run('probe.stato'), 'errore'); assert.equal(await run('probe.errore'), 'Trascrizione non letta');
    assert.equal(pending.length, n + 1); console.log('ASYNC_V1_RESTART_FAILURE_KEEPS_ERROR_OK');

    const invalid = await fetch('NoProtocol', [user('Non accettare legacy')]);
    await settle(invalid, { messaggi: [user('Non accettare legacy')], pagina: 0, haAltre: false, totale: 1, errore: null });
    assert.equal(await run('probe.stato'), 'errore'); assert.match(await run('probe.errore'), /Messaggi non leggibili/);
    assert.equal(await run('probe.messaggi.length'), 0); console.log('ASYNC_V1_MISSING_METADATA_REJECTED');
    console.log('ASYNC_CHAT_ISOLATION_OK');

    // Renderer completo: il turno iniziale è parziale, poi il prepend ne scopre l'inizio.
    ipcMain.removeHandler('sessioni:messaggi');
    const { collegaScena } = require('../dist/src/scena.js');
    const scene = require('../design/scene/101-8036.json');
    const chatId = scene.elenco.sessioni[0].id;
    scene.elenco.sessioni[0].stato = 'ferma';
    scene.messaggi[chatId] = [user('Inizio turno precedente'), { tipo: 'pensiero', testo: 'Pensiero persistente', t: null },
      ...Array.from({ length: 49 }, (_, i) => ({ tipo: 'assistente', testo: 'Risposta stabile ' + i, modello: null, t: null }))];
    collegaScena(ipcMain, scene);
    await win.loadFile(path.join(root, 'renderer/index.html'), { query: { vista: 'sessione', sessione: chatId } });
    await wait(async () => await run('!!document.querySelector(".pensiero .testata")'), 'pensiero del renderer completo');
    await run(`window.retainedThought = document.querySelector('.pensiero');
      window.retainedButton = retainedThought.querySelector('button'); retainedButton.click(); retainedButton.focus();`);
    await wait(async () => await run('document.querySelector(".testo-pensiero")?.textContent === "Pensiero persistente"'), 'pensiero espanso');
    assert.equal(await run('document.activeElement === retainedButton'), true);
    await run(`[...document.querySelectorAll('.precedenti button')].find(b=>b.textContent==='Carica precedenti')?.click()`); // il focus può già averle caricate dallo scorrimento in cima (Filo.tsx:100)
    await wait(async () => await run('document.querySelector(".messaggio-roberto .bolla")?.textContent === "Inizio turno precedente"'), 'prepend vero della chat');
    assert.equal(await run('document.querySelector(".pensiero") === retainedThought && retainedThought.isConnected'), true);
    assert.equal(await run('retainedButton.getAttribute("aria-expanded")'), 'true');
    assert.equal(await run('document.activeElement === retainedButton'), true);
    emit({ tipo: 'upsert', sessione: chatId, epoca: `fixture:${chatId}`, daSeq: 1, aSeq: 2, totale: 52,
      righe: [{ chiave: `fixture:${chatId}:51`, ordine: 51, revisione: 2,
        messaggio: { tipo: 'assistente', testo: 'Risposta aggiunta dal vivo', modello: null, t: null } }] });
    await wait(async () => await run('[...document.querySelectorAll(".testo-risposta")].some(e=>e.textContent==="Risposta aggiunta dal vivo")'), 'append vero della chat');
    assert.equal(await run('document.querySelector(".pensiero") === retainedThought'), true);
    assert.equal(await run('retainedButton.getAttribute("aria-expanded")'), 'true');
    assert.equal(await run('document.activeElement === retainedButton'), true);
    console.log('ASYNC_V1_REAL_CHAT_PREPEND_APPEND_DOM_FOCUS_EXPANSION_OK');
    hidden(); console.log('HIDDEN_WINDOW_OK shows=0 focus=0');
    console.log('ASYNC_V1_CHRONOLOGY_OK');
    win.destroy(); fs.rmSync(temp, { recursive: true, force: true }); app.exit(0);
  } catch (error) {
    console.error(error); if (win) win.destroy(); fs.rmSync(temp, { recursive: true, force: true }); app.exit(1);
  }
});
