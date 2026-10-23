// Esegue il main vero in VM: Electron, servizi e voce sono confini intercettati.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function normalWindow(silent) {
  const calls = [];
  const output = {};
  const windowCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/finestra.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const modules = {
    electron: { BrowserWindow: class {
      constructor(options) {
        calls.push({ name: 'construct', show: options.show });
        this.webContents = { setAudioMuted: value => calls.push({ name: 'mute', value }) };
      }
      loadFile() { calls.push({ name: 'load' }); }
    } },
    './ui/base/token': { numero: () => 1, valori: {} },
    './branding': { iconaApp() {}, NOME_APP: 'clotch' },
    './link-esterni': { proteggiLinkEsterni() {} },
    './modalita-prova': { provaSilenziosa: () => silent },
  };
  vm.runInNewContext(windowCode, {
    exports: output, __dirname: path.join(__dirname, '../dist/src'),
    require: name => {
      if (name.startsWith('node:')) return require(name);
      assert.ok(Object.hasOwn(modules, name), `confine finestra inatteso ${name}`);
      return modules[name];
    },
  });
  output.apriFinestra();
  return calls;
}

async function run(args, scene) {
  const calls = [], errors = [];
  const env = {};
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
  assert.deepEqual(normalWindow(true), [
    { name: 'construct', show: true }, { name: 'mute', value: true }, { name: 'load' },
  ]);
  assert.deepEqual(normalWindow(false), [{ name: 'construct', show: true }, { name: 'load' }]);
  console.log('WINDOW_AUDIO_ORDER_OK: mute prima loadFile solo in prova silenziosa; audio normale invariato');
  console.log('PARITA_MAIN_ISOLATION_OK: scena assente/rotta e argomento mancante falliscono senza servizi live; app normale invariata');
})().catch(error => { console.error(error); process.exitCode = 1; });
