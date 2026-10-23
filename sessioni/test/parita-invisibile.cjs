// Esegue il main vero in VM: Electron, servizi e voce sono confini intercettati.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

const external = { internal: false, workArea: { x: 0, y: 25, width: 2560, height: 1415 } };
const internal = { internal: true, workArea: { x: -1512, y: 38, width: 1512, height: 907 } };
function normalWindow(silent, displays = [external, internal], primary = external, options = {}) {
  const calls = [], screenCalls = [];
  let createdOptions, ready;
  const output = {};
  const windowCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/finestra.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const modules = {
    electron: { screen: {
      getAllDisplays() { screenCalls.push('all'); return displays; },
      getPrimaryDisplay() { screenCalls.push('primary'); return primary; },
    }, BrowserWindow: class {
      constructor(options) {
        createdOptions = options;
        calls.push({ name: 'construct', show: options.show });
        this.webContents = { setAudioMuted: value => calls.push({ name: 'mute', value }) };
      }
      loadFile() { calls.push({ name: 'load' }); }
      once(event, callback) { assert.equal(event, 'ready-to-show'); ready = callback; }
      showInactive() { calls.push({ name: 'showInactive' }); }
      show() { assert.fail('show attivante non consentito'); }
      focus() { assert.fail('focus non consentito'); }
      hide() { assert.fail('hide tardivo non consentito'); }
    } },
    './ui/base/token': { numero: () => 1, valori: { 'colore-fondo-cornice': '#222222' } },
    './branding': { iconaApp() {}, NOME_APP: 'clotch' },
    './link-esterni': { proteggiLinkEsterni() {} },
    './modalita-prova': { provaSilenziosa: () => silent },
  };
  vm.runInNewContext(windowCode, {
    exports: output, __dirname: path.join(__dirname, '../dist/src'),
    require: name => {
      if (name === 'node:fs') return { ...fs, existsSync: () => true };
      if (name.startsWith('node:')) return require(name);
      assert.ok(Object.hasOwn(modules, name), `confine finestra inatteso ${name}`);
      return modules[name];
    },
  });
  output.apriFinestra(undefined, options);
  return { calls, screenCalls, options: createdOptions, emitReady: () => ready?.() };
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
  const ipcMain = { handle() {} };
  const modules = {
    electron: { app, ipcMain, BrowserWindow: { getAllWindows: () => [] } },
    './api': { Sessioni: class {
      elencoSessioni() { return { sessioni: [], errori: [] }; }
      osserva() { calls.push('osserva'); }
    } },
    './avvisi-mac': { collegaAvvisi: record('avvisi-live') },
    './barra-menu': { collegaBarraMenu: () => record('tray-live') },
    './branding': { impostaNome: record('nome'), impostaIdentita: record('identita') },
    './finestra': { apriFinestra: record('finestra-live'), parita: record('parita') },
    './friday-ipc': { collegaFriday: record('friday-live') },
    './impostazioni': { collegaImpostazioni: record('impostazioni-live') },
    './indice-ipc': { collegaIndice: () => { calls.push('indice-live'); return {}; } },
    './preferenze': { leggiImpostazioni: () => ({}) },
    './preferenze-ipc': { collegaPreferenze: record('preferenze-live') },
    './registro': { CARTELLA_REGISTRO: '/test-no-real-user', scriviRegistro: record('registro-live'), testoErrore: String },
    './scena': { leggiScena: () => { if (scene instanceof Error) throw scene; return scene; }, fileScena: () => '/test-fixture', collegaScena: record('scena') },
    './modalita-prova': { provaSilenziosa: () => env.CLOTCH_TEST_SILENT === '1' },
  };
  vm.runInNewContext(code, {
    exports: {}, __dirname: '/test/dist/src',
    process: { platform: 'darwin', argv: ['electron', '.', ...args], env, on() {} },
    console: { error: (...args) => errors.push(args.join(' ')) },
    require: name => {
      if (name === 'node:os' || name === 'node:path') return require(name);
      assert.ok(Object.hasOwn(modules, name), `confine inatteso ${name}`);
      return modules[name];
    },
  });
  await new Promise(setImmediate);
  return { calls, errors, env };
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
    './avvisi': { daAvvisare: () => ({ titolo: 'Test', corpo: 'Test', silenzioso: false, suono: 'default' }) },
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
  assert.ok(normal.calls.includes('friday-live') && normal.calls.includes('finestra-live'));
  assert.ok(!normal.calls.some(c => c.startsWith('exit:')));
  const preview = await run([], null, { CLOTCH_TEST_SILENT: '1' });
  assert.ok(preview.calls.indexOf('policy:accessory') < preview.calls.indexOf('ready'));
  assert.ok(preview.calls.indexOf('switch:mute-audio') < preview.calls.indexOf('ready'));
  assert.ok(!preview.calls.includes('policy:prohibited'));
  const production = normalWindow(false);
  assert.deepEqual(production.calls, [{ name: 'construct', show: true }, { name: 'load' }]);
  assert.deepEqual(production.screenCalls, []);
  assert.equal(production.options.x, undefined);
  production.emitReady();
  assert.equal(production.calls.length, 2);
  const hidden = normalWindow(true, [], external, { show: false });
  assert.deepEqual(hidden.calls, [{ name: 'construct', show: false }, { name: 'mute', value: true }, { name: 'load' }]);
  assert.deepEqual(hidden.screenCalls, []);
  hidden.emitReady();
  assert.equal(hidden.calls.length, 3, 'test show:false non viene mai mostrato');
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
    [[], { workArea: { x: 80, y: -600, width: 640, height: 480 } }, { x: 80, y: -600, width: 640, height: 480 }],
  ]) {
    const window = normalWindow(true, displays, primary);
    assert.deepEqual(window.calls, [{ name: 'construct', show: false }, { name: 'mute', value: true }, { name: 'load' }]);
    inside(window.options, area);
    assert.deepEqual(window.screenCalls, displays.some(d => d.internal) ? ['all'] : ['all', 'primary']);
    window.emitReady();
    assert.deepEqual(window.calls.at(-1), { name: 'showInactive' });
    assert.equal(window.calls.length, 4, 'mute e caricamento precedono showInactive');
  }
  console.log('PREVIEW_INTERNAL_ORDER_OK: interno, fallback e limiti prima del paint; mute/load/ready/showInactive; test nascosti preservati');
  console.log('WINDOW_AUDIO_ORDER_OK: mute prima loadFile solo in prova silenziosa; audio normale invariato');
  console.log('PARITA_MAIN_ISOLATION_OK: scena assente/rotta e argomento mancante falliscono senza servizi live; app normale invariata');
  assert.deepEqual(notificationCalls(false), ['supported', 'construct', 'show'], 'controllo positivo notifiche normali');
  assert.deepEqual(notificationCalls(true), [], 'nessuna costruzione o invio OS in prova');
  console.log('PREVIEW_NOTIFICATIONS_BLOCKED_OK: zero API/istanze/invii OS in prova; controllo positivo normale preservato');
  console.log('PREVIEW_450_OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
