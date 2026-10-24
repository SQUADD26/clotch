// Esegue il main vero in VM: Electron, servizi e voce sono confini intercettati.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const fiducia = require('../dist/src/ipc-fiducia.js');
const channels = [...fs.readFileSync(path.join(__dirname, '../src/preload.ts'), 'utf8').matchAll(/invoke\("([^"]+)"/g)].map(m => m[1]);
const source = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

const external = { internal: false, workArea: { x: 0, y: 25, width: 2560, height: 1415 } };
const internal = { internal: true, workArea: { x: -1512, y: 38, width: 1512, height: 907 } };
function normalWindow(silent, displays = [external, internal], primary = external, options = {}, anteprima = silent) {
  const calls = [], screenCalls = [], logs = [];
  let createdOptions, ready, visible = false, muted = false, permissionsReady = false;
  const output = {};
  const windowCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/finestra.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const modules = {
    electron: { app: { quit() {} }, screen: {
      getAllDisplays() { screenCalls.push('all'); return displays; },
      getPrimaryDisplay() { screenCalls.push('primary'); return primary; },
      getDisplayMatching(bounds) {
        assert.equal(bounds.x, createdOptions.x);
        assert.equal(bounds.y, createdOptions.y);
        return displays.find(d => bounds.x >= d.workArea.x && bounds.x < d.workArea.x + d.workArea.width) ?? primary;
      },
    }, BrowserWindow: class {
      constructor(options) {
        createdOptions = options;
        calls.push({ name: 'construct', show: options.show });
        const frame = { url: '' };
        this.webContents = { mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false,
          executeJavaScript: async () => {}, capturePage: async () => ({ toPNG: () => Buffer.alloc(0), getSize: () => ({ width: 1, height: 1 }) }),
          setAudioMuted: value => { muted = value; calls.push({ name: 'mute', value }); },
          isAudioMuted: () => muted,
        };
      }
      loadFile(file) {
        assert.equal(permissionsReady, true, 'policy permessi prima del caricamento');
        this.webContents.mainFrame.url = pathToFileURL(file).href;
        fiducia.verificaChiamante({ sender: this.webContents, senderFrame: this.webContents.mainFrame });
        calls.push({ name: 'load' });
      }
      on() {}
      once(event, callback) { assert.equal(event, 'ready-to-show'); ready = callback; }
      showInactive() { visible = true; calls.push({ name: 'showInactive' }); }
      getBounds() { return createdOptions; }
      isVisible() { return visible; }
      isFocused() { return false; }
      show() { assert.equal(silent, false, 'show attivante solo fuori prova'); visible = true; calls.push({ name: 'show' }); }
      focus() { assert.fail('focus non consentito'); }
      hide() { assert.fail('hide tardivo non consentito'); }
    } },
    './ui/base/token': { numero: () => 1, valori: { 'colore-fondo-cornice': '#222222' } },
    './branding': { iconaApp() {}, NOME_APP: 'clotch' },
    './link-esterni': { proteggiLinkEsterni() {} },
    './modalita-prova': { provaSilenziosa: () => silent },
    './ipc-fiducia': fiducia,
    './permessi': { impostaPermessi() { permissionsReady = true; } },
  };
  vm.runInNewContext(windowCode, {
    exports: output, process: { env: anteprima ? { CLOTCH_TEST_ANTEPRIMA: '1' } : {} }, __dirname: path.join(__dirname, '../dist/src'), console: { log: line => logs.push(line) },
    require: name => {
      if (name === 'node:fs') return { ...fs, existsSync: () => true, mkdirSync() {}, writeFileSync() {} };
      if (name.startsWith('node:')) return require(name);
      assert.ok(Object.hasOwn(modules, name), `confine finestra inatteso ${name}`);
      return modules[name];
    },
  });
  const loaded = options.parita ? output.parita('101-8036') : output.apriFinestra(undefined, options);
  return { loaded, calls, screenCalls, logs, options: createdOptions, emitReady: () => ready?.() };
}

async function run(args, scene, initialEnv = {}) {
  const calls = [], errors = [];
  const env = { ...initialEnv };
  const record = name => () => { calls.push(name); };
  const app = {
    commandLine: { appendSwitch: name => calls.push(`switch:${name}`) },
    setActivationPolicy: policy => calls.push(`policy:${policy}`),
    whenReady: () => { calls.push('ready'); return Promise.resolve(); },
    getPath: () => '/test-no-real-user', on() {}, exit: code => calls.push(`exit:${code}`),
  };
  const handlers = new Map();
  let ready; // ready-to-show della finestra finta
  const ipcMain = { handle: (canale, fn) => handlers.set(canale, fn) };
  const modules = {
    electron: { app, ipcMain, BrowserWindow: { getAllWindows: () => [] } },
    './allegati-ipc': { collegaAllegati: record('casella-live') },
    './api': { Sessioni: class {
      elencoSessioni() { calls.push('elenco-letto'); return { sessioni: [], errori: [] }; }
      osservaInWorker() { calls.push("osserva"); }
    } },
    './avvisi-mac': { collegaAvvisi: record('avvisi-live') },
    './barra-menu': { collegaBarraMenu: () => record('tray-live') },
    './branding': { impostaNome: record('nome'), impostaIdentita: record('identita') },
    './finestra': { apriFinestra: () => { calls.push('finestra-live'); return { once: (_ev, cb) => { ready = cb; } }; }, parita: record('parita') },
    './clotch-ai-ipc': { collegaClotchAi: record('clotch-ai-live') },
    './impostazioni': { collegaImpostazioni: record('impostazioni-live') },
    './info-sessione': { infoSessione() {} },
    './indice-ipc': { collegaIndice: (_ipc, _s, quando) => { quando.then(() => calls.push('indice-live')); return {}; } },
    './preferenze': { leggiImpostazioni: () => ({}) },
    './casella-ipc': { collegaCasella: record('casella-live') },
    './nuova-sessione': { collegaNuovaSessione: record('nuova-sessione-live') },
    './preferenze-ipc': { collegaPreferenze: record('preferenze-live') },
    './registro': { CARTELLA_REGISTRO: '/test-no-real-user', scriviRegistro: record('registro-live'), testoErrore: String },
    './scena': { leggiScena: () => { if (scene instanceof Error) throw scene; return scene; }, fileScena: () => '/test-fixture', collegaScena(ipc) { calls.push('scena'); for (const c of channels) ipc.handle(c, (_e, ...a) => { calls.push('ipc:' + c); return a; }); } },
    './modalita-prova': { provaSilenziosa: () => env.CLOTCH_TEST_SILENT === '1' },
    './ipc-fiducia': fiducia,
  };
  vm.runInNewContext(code, {
    exports: {}, __dirname: '/test/dist/src', setImmediate, setTimeout: () => ({ unref() {} }),
    process: { platform: 'darwin', argv: ['electron', '.', ...args], env, on() {} },
    console: { error: (...args) => errors.push(args.join(' ')) },
    require: name => {
      if (name === 'node:os' || name === 'node:path') return require(name);
      assert.ok(Object.hasOwn(modules, name), `confine inatteso ${name}`);
      return modules[name];
    },
  });
  await new Promise(setImmediate);
  return { calls, errors, env, handlers, ready: () => ready() };
}

function notificationCalls(silent) {
  const calls = [], output = {};
  const notificationsCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/avvisi-mac.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const modules = {
    electron: { Notification: class {
      static isSupported() { calls.push('supported'); return true; }
      constructor() { calls.push('construct'); }
      show() { calls.push('show'); }
    } },
    './modalita-prova': { provaSilenziosa: () => silent },
    './ipc-fiducia': fiducia,
    './avvisi': { daAvvisare: () => ({ titolo: 'Test', corpo: 'Test', silenzioso: false, suono: 'default' }), inSilenzio: () => false },
    './partenza': { PARTENZA: { silenzio: 'Mai' } },
    './quote-uso': { quoteUso: () => Promise.reject(new Error('rete non usata nella prova')), sogliePassate: () => [] }, // avvisi 80%/90% (#456): niente rete
  };
  vm.runInNewContext(notificationsCode, { exports: output, require: name => {
    assert.ok(Object.hasOwn(modules, name), `confine notifiche inatteso ${name}`);
    return modules[name];
  } });
  const notify = output.collegaAvvisi(() => [{ id: 's1' }], () => ({}));
  notify({ sessioni: ['s1'] });
  return calls;
}

(async () => {
  for (const [args, scene] of [[['--parita', 'missing'], null], [['--parita'], null], [['--parita', 'broken'], new SyntaxError('fixture JSON')]]) {
    const { calls, errors, env } = await run(args, scene);
    assert.ok(calls.indexOf('policy:prohibited') < calls.indexOf('ready'));
    assert.ok(calls.indexOf('switch:mute-audio') < calls.indexOf('ready'));
    assert.equal(env.CLOTCH_TEST_SILENT, '1');
    assert.ok(calls.includes('exit:1'));
    assert.match(errors[0], /scena non disponibile/);
    assert.deepEqual(calls.filter(c => c.endsWith('-live')), []);
    assert.ok(!calls.includes('parita') && !calls.includes('scena'));
  }
  const fixture = await run(['--parita', '101-8036'], { navigazione: {} });
  assert.ok(fixture.calls.indexOf('policy:prohibited') < fixture.calls.indexOf('ready'));
  assert.equal(fixture.env.CLOTCH_TEST_SILENT, '1');
  assert.deepEqual(fixture.calls.filter(c => ['scena', 'parita'].includes(c)), ['scena', 'parita']);
  assert.deepEqual(fixture.calls.filter(c => c.endsWith('-live')), []);
  const normal = await run([], null);
  assert.ok(!normal.calls.includes('policy:prohibited'), 'app normale conserva attivazione');
  assert.ok(!normal.calls.includes('switch:mute-audio'));
  assert.equal(normal.env.CLOTCH_TEST_SILENT, undefined);
  assert.ok(normal.calls.includes('clotch-ai-live') && normal.calls.includes('finestra-live'));
  assert.ok(!normal.calls.some(c => c.startsWith('exit:')));
  // #463: la finestra parte prima di ogni lettura di sessioni; canali già registrati, risposta dopo il ready-to-show
  const calls463 = normal.calls;
  assert.ok(calls463.indexOf('finestra-live') > calls463.indexOf('clotch-ai-live'), 'canali registrati prima del caricamento');
  for (const c of ['elenco-letto', 'osserva', 'avvisi-live', 'tray-live', 'indice-live']) assert.ok(!calls463.includes(c), `${c} prima della prima finestra`);
  const doc463 = '/tmp/avvio 463/renderer/index.html', fr463 = { url: pathToFileURL(doc463).href };
  const sender463 = { mainFrame: fr463, getURL: () => fr463.url, isDestroyed: () => false };
  fiducia.autorizzaIpc(sender463, doc463);
  let risposta463 = null;
  normal.handlers.get('sessioni:elenco')({ sender: sender463, senderFrame: fr463 }).then(e => { risposta463 = e; });
  await new Promise(setImmediate);
  assert.equal(risposta463, null, 'elenco in attesa finché la finestra non è pronta');
  assert.ok(!calls463.includes('elenco-letto'));
  normal.ready();
  for (let i = 0; i < 3; i++) await new Promise(setImmediate);
  for (const c of ['elenco-letto', 'osserva', 'avvisi-live', 'tray-live', 'indice-live']) assert.ok(calls463.indexOf(c) > calls463.indexOf('finestra-live'), `${c} dopo la finestra`);
  assert.ok(calls463.indexOf('osserva') < calls463.indexOf('avvisi-live'), 'avvisi dopo osserva');
  assert.deepEqual(risposta463, { sessioni: [], errori: [] }, 'elenco risposto dopo la finestra');
  console.log('AVVIO_463_OK: finestra prima di elenco, osservatore, avvisi, menu e indice');
  const preview = await run([], null, { CLOTCH_TEST_SILENT: '1' });
  assert.ok(preview.calls.indexOf('policy:accessory') < preview.calls.indexOf('ready'));
  assert.ok(preview.calls.indexOf('switch:mute-audio') < preview.calls.indexOf('ready'));
  assert.ok(!preview.calls.includes('policy:prohibited'));
  const production = normalWindow(false);
  assert.deepEqual(production.calls, [{ name: 'construct', show: false }, { name: 'load' }], 'mai show:true alla creazione');
  assert.deepEqual(production.screenCalls, ['all']);
  assert.equal(production.options.x, internal.workArea.x + Math.floor((internal.workArea.width - production.options.width) / 2), 'centrata nella workArea integrata');
  assert.equal(production.options.backgroundColor, '#222222');
  production.emitReady();
  assert.deepEqual(production.calls.at(-1), { name: 'show' }, 'show solo dopo ready-to-show');
  assert.equal(production.calls.length, 3);
  assert.deepEqual(production.logs, []);
  const productionNoInternal = normalWindow(false, [external], external);
  assert.deepEqual(productionNoInternal.screenCalls, ['all', 'primary'], 'senza integrato: schermo principale');
  assert.ok(productionNoInternal.options.x >= external.workArea.x && productionNoInternal.options.x + productionNoInternal.options.width <= external.workArea.x + external.workArea.width);
  console.log('WINDOW_NORMAL_INTERNAL_OK: finestra normale su integrato (o primario), show:false, show a ready-to-show, fondo impostato');
  const hidden = normalWindow(true, [], external, { show: false });
  assert.deepEqual(hidden.calls, [{ name: 'construct', show: false }, { name: 'mute', value: true }, { name: 'load' }]);
  assert.deepEqual(hidden.screenCalls, []);
  hidden.emitReady();
  assert.equal(hidden.calls.length, 3, 'test show:false non viene mai mostrato');
  assert.deepEqual(hidden.logs, []);
  const hiddenNormal = normalWindow(false, [], external, { show: false });
  hiddenNormal.emitReady();
  assert.deepEqual(hiddenNormal.calls, [{ name: 'construct', show: false }, { name: 'load' }]);
  const inside = (options, area) => {
    assert.ok(options.x >= area.x && options.y >= area.y);
    assert.ok(options.x + options.width <= area.x + area.width);
    assert.ok(options.y + options.height <= area.y + area.height);
    assert.ok(options.minWidth <= options.width && options.minHeight <= options.height);
    assert.equal(options.backgroundColor, '#222222', 'sfondo scuro prima del primo paint');
  };
  for (const [displays, primary, area] of [
    [[external, internal], external, internal.workArea],
    [[external], external, external.workArea],
    [[], { internal: false, workArea: { x: 80, y: -600, width: 640, height: 480 } }, { x: 80, y: -600, width: 640, height: 480 }],
  ]) {
    const window = normalWindow(true, displays, primary);
    assert.deepEqual(window.calls, [{ name: 'construct', show: false }, { name: 'mute', value: true }, { name: 'load' }]);
    inside(window.options, area);
    assert.deepEqual(window.screenCalls, displays.some(d => d.internal) ? ['all'] : ['all', 'primary']);
    window.emitReady();
    assert.deepEqual(window.calls.at(-1), { name: 'showInactive' });
    assert.equal(window.calls.length, 4, 'mute e caricamento precedono showInactive');
    assert.equal(window.logs.length, 1, 'una sola riga di osservazione');
    assert.equal(window.logs[0], `PREVIEW_READY internal=${displays.some(d => d.internal) ? true : primary.internal} visible=true focused=false audioMuted=true`);
  }
  const soloSilent = normalWindow(true, [external, internal], external, {}, false);
  assert.deepEqual(soloSilent.calls, [{ name: 'construct', show: false }, { name: 'mute', value: true }, { name: 'load' }]);
  assert.deepEqual(soloSilent.screenCalls, []);
  soloSilent.emitReady();
  assert.equal(soloSilent.calls.length, 3, 'SILENT da solo non mostra mai la finestra');
  assert.deepEqual(soloSilent.logs, []);
  console.log('PREVIEW_INTERNAL_ORDER_OK: interno, fallback e limiti prima del paint; mute/load/ready/showInactive; test nascosti preservati');
  console.log('PREVIEW_READY_MARKER_OK: riga unica dopo showInactive; interno/fallback e stato finestra/audio misurati dai confini');
  console.log('WINDOW_AUDIO_ORDER_OK: mute prima loadFile solo in prova silenziosa; audio normale invariato');
  console.log('PARITA_MAIN_ISOLATION_OK: scena assente/rotta e argomento mancante falliscono senza servizi live; app normale invariata');
  assert.deepEqual(notificationCalls(false), ['supported', 'construct', 'show'], 'controllo positivo notifiche normali');
  assert.deepEqual(notificationCalls(true), [], 'nessuna costruzione o invio OS in prova');
  console.log('PREVIEW_NOTIFICATIONS_BLOCKED_OK: zero API/istanze/invii OS in prova; controllo positivo normale preservato');
  const parityWindow = normalWindow(true, [], external, { parita: true });
  await parityWindow.loaded;
  assert.ok(parityWindow.logs.some(line => line.startsWith('PARITA_HIDDEN_OK')));
  console.log('IPC_FACTORIES_REGISTER_BEFORE_LOAD_OK');
  console.log('PERMESSI_FACTORIES_BEFORE_LOAD_OK');
  const documentPath = '/tmp/clotch fixture #1/renderer/index.html';
  const expectedUrl = pathToFileURL(documentPath).href;
  const frame = { url: expectedUrl + '?sessione=s%201#messaggio' };
  const sender = { mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false };
  fiducia.autorizzaIpc(sender, documentPath);
  const trusted = { sender, senderFrame: frame };
  const secured = await run(['--parita', '101-8036'], {});
  assert.equal(new Set(channels).size, channels.length);
  assert.equal(secured.handlers.size, channels.length);
  for (const [channel, invoke] of secured.handlers) {
    assert.deepEqual(await invoke(trusted, 'fixture', 7), ['fixture', 7]);
    assert.equal(secured.calls.filter(c => c === 'ipc:' + channel).length, 1);
  }
  const rejected = [
    { sender, senderFrame: { url: frame.url } }, // iframe identico URL, stesso webContents
    { sender: { ...sender }, senderFrame: frame }, // finestra estranea, stesso URL
    { sender, senderFrame: null },
    { sender: { ...sender, isDestroyed: () => true }, senderFrame: frame },
    { sender, get senderFrame() { throw Error('frame distrutto'); } },
  ];
  for (const event of rejected) {
    for (const invoke of secured.handlers.values()) await assert.rejects(invoke(event), /non autorizzato/);
  }
  for (const url of ['https://example.org/renderer/index.html', 'file:///tmp/evil/index.html',
    expectedUrl + '.evil', expectedUrl + '/evil', 'file://estraneo/tmp/index.html',
    'data:text/html,fixture', 'about:blank', 'url non valido']) {
    frame.url = url;
    for (const invoke of secured.handlers.values()) await assert.rejects(invoke(trusted), /non autorizzato/);
  }
  frame.url = expectedUrl;
  sender.getURL = () => 'https://example.org/';
  for (const invoke of secured.handlers.values()) await assert.rejects(invoke(trusted), /non autorizzato/);
  sender.getURL = () => frame.url; sender.isDestroyed = () => true;
  for (const invoke of secured.handlers.values()) await assert.rejects(invoke(trusted), /non autorizzato/);
  sender.isDestroyed = () => false;
  const before = secured.calls.filter(c => c.startsWith('ipc:')).length;
  assert.equal(before, channels.length, 'nessun callback di canale eseguito per chiamante respinto');
  assert.deepEqual(await secured.handlers.get('sessioni:elenco')(trusted), []);
  console.log('IPC_REJECTS_CHILD_FOREIGN_WINDOW_URL_AND_DESTROYED_OK');
  console.log('IPC_ENCODED_FILE_QUERY_HASH_AND_VALID_CALLER_OK');
  console.log('IPC_ALL_CHANNELS_TRUST_OK channels=' + channels.length + ' refusedCallbacks=0');
  console.log('PREVIEW_450_OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
