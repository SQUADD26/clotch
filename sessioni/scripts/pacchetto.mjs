// Pacchetto macOS locale: staging chiuso, nessuna installazione o avvio dell'app.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { builtinModules, createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = path.dirname(root.replace(/\/$/, ''));
const work = path.join(repo, '.build', 'electron');
const stage = path.join(work, 'staging');
const out = path.join(work, 'pacchetto');
const icon = path.join(repo, 'Sources', 'Clotch', 'Resources', 'AppIcon.icns');
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log(`Uso: npm run pacchetto:mac
Crea ${out}/clotch-darwin-arm64/clotch.app con Electron fissato nel lock.
Esegue prima la build. Richiede macOS arm64, Node >=22.12 e npm ci locale.
Include solo moduli main raggiungibili, renderer, icona, eseguibile della dettatura (swiftc) e frame/scena necessari.
Firma ad hoc locale. Non installa, non avvia, non crea DMG, non notarizza e non usa Keychain.
Sovrascrive soltanto lo staging e l'output .build/electron di questo checkout.
La prova GUI richiede autorizzazione separata: CLOTCH_TEST_SILENT non nasconde la preview.`);
  process.exit(0);
}
assert.equal(args.length, 0, 'Opzioni sconosciute: usare --help');
assert.equal(process.platform, 'darwin', 'Il pacchetto locale richiede macOS');
assert.equal(process.arch, 'arm64', 'Questa consegna richiede Mac arm64');
const modules = path.join(root, 'node_modules');
assert.equal((await fs.lstat(modules)).isSymbolicLink(), false, 'Usare node_modules privato, non un symlink');
assert.equal(await fs.realpath(modules), modules.replace(/\/$/, ''), 'node_modules deve appartenere al checkout');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.devDependencies.electron;
assert.match(version, /^\d+\.\d+\.\d+$/, 'Electron deve avere versione esatta');
const require = createRequire(import.meta.url);
assert.equal(require('electron/package.json').version, version, 'Eseguire npm ci sul lock corrente');
assert.equal((await fs.readFile(icon)).subarray(0, 4).toString(), 'icns');
execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
await fs.mkdir(work, { recursive: true });
assert.equal(await fs.realpath(work), work, 'Output deve restare nel checkout, senza symlink');
for (const dir of [stage, out]) {
  try { assert.equal((await fs.lstat(dir)).isSymbolicLink(), false, 'Staging/output non possono essere symlink'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  await fs.rm(dir, { recursive: true, force: true });
}
await fs.mkdir(stage);
const files = new Map();
async function copy(relative) {
  assert.ok(!path.isAbsolute(relative) && !relative.split(path.sep).includes('..'), 'Percorso fuori allowlist');
  const source = path.join(root, relative);
  assert.equal((await fs.lstat(source)).isFile(), true, `File normale richiesto: ${relative}`);
  const content = await fs.readFile(source);
  const dest = path.join(stage, relative);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content);
  files.set(relative, createHash('sha256').update(content).digest('hex'));
}
// Nessuna copia ricorsiva del repository: solo il grafo CommonJS prodotto da tsc.
const visited = new Set();
async function mainModule(relative) {
  if (visited.has(relative)) return;
  assert.ok(relative.startsWith('dist/src/') && relative.endsWith('.js'), 'Modulo main fuori dist/src');
  visited.add(relative);
  await copy(relative);
  const text = await fs.readFile(path.join(root, relative), 'utf8');
  const ts = require('typescript');
  const tree = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      assert.ok(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), `require dinamico non ammesso: ${relative}`);
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const id of imports) {
    if (id.startsWith('.')) {
      const target = path.normalize(path.join(path.dirname(relative), id));
      await mainModule(target.endsWith('.js') ? target : `${target}.js`);
    } else assert.ok(id === 'electron' || builtinModules.includes(id) || builtinModules.includes(id.replace(/^node:/, '')), `Dipendenza runtime non inclusa: ${id}`);
  }
}
await mainModule(pkg.main);
// BrowserWindow carica il preload per percorso, fuori dal grafo require del main.
await mainModule('dist/src/preload.js');
// Dettatura dell'app (#470): eseguibile nativo (native/dettatura.swift) accanto al main; i due testi del permesso stanno nel plist dell'app e in quello incorporato nell'eseguibile.
const privacy = {
  NSMicrophoneUsageDescription: 'clotch usa il microfono per scrivere quello che detti.',
  NSSpeechRecognitionUsageDescription: 'clotch usa il riconoscimento vocale del Mac per trasformare in testo quello che detti.',
};
const plistDettatura = path.join(work, 'dettatura.plist');
await fs.writeFile(plistDettatura, JSON.stringify({ CFBundleIdentifier: 'com.squadd.clotch.dettatura', ...privacy }));
execFileSync('/usr/bin/plutil', ['-convert', 'xml1', plistDettatura]);
await fs.mkdir(path.join(stage, 'bin'));
const dettatura = path.join(stage, 'bin', 'dettatura');
execFileSync('/usr/bin/swiftc', ['-O', '-target', 'arm64-apple-macos13', path.join(root, 'native', 'dettatura.swift'), '-o', dettatura,
  '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plistDettatura], { stdio: 'inherit' });
files.set('bin/dettatura', createHash('sha256').update(await fs.readFile(dettatura)).digest('hex'));
async function renderer(dir) {
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) await renderer(relative);
    else {
      assert.ok(/\.(html|js|css|woff2?|ttf|png|svg)$/.test(entry.name), `Asset renderer inatteso: ${relative}`);
      await copy(relative);
    }
  }
}
await renderer('renderer');
// Le misure delle finestre si leggono a runtime da design/figma/<id>.json: si copiano tutti i frame che finestra.ts chiede.
const misure = [...(await fs.readFile(path.join(root, 'src', 'finestra.ts'), 'utf8')).matchAll(/frame\("([\d-]+)"\)/g)].map((m) => `design/figma/${m[1]}.json`);
assert.ok(misure.length > 0, 'nessun frame di misura trovato in src/finestra.ts');
for (const file of new Set(['assets/app-icon.png', ...misure, 'design/figma/101-8610.json', 'design/scene/101-8036.json'])) await copy(file);
const appPackage = { name: pkg.name, productName: 'clotch', version: pkg.version, main: pkg.main, private: true };
await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify(appPackage, null, 2) + '\n');
const { packager } = await import('@electron/packager');
const outputs = await packager({ dir: stage, out, name: 'clotch', executableName: 'clotch',
  platform: 'darwin', arch: 'arm64', electronVersion: version, icon,
  appBundleId: 'com.squadd.clotch.sessioni', helperBundleId: 'com.squadd.clotch.sessioni.helper',
  appVersion: pkg.version, appCategoryType: 'public.app-category.developer-tools',
  asar: false, prune: false, derefSymlinks: false, overwrite: false,
  extendInfo: { CFBundleName: 'clotch', CFBundleDisplayName: 'clotch', ...privacy },
});
assert.equal(outputs.length, 1);
const bundle = path.join(outputs[0], 'clotch.app');
const plistPath = path.join(bundle, 'Contents', 'Info.plist');
const plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' }));
assert.equal(plist.CFBundleName, 'clotch');
assert.equal(plist.CFBundleDisplayName, 'clotch');
assert.equal(plist.CFBundleIdentifier, 'com.squadd.clotch.sessioni');
assert.equal(plist.CFBundleExecutable, 'clotch');
for (const k of Object.keys(privacy)) assert.equal(plist[k], privacy[k], k);
const iconFile = plist.CFBundleIconFile.endsWith('.icns') ? plist.CFBundleIconFile : `${plist.CFBundleIconFile}.icns`;
const sha = (data) => createHash('sha256').update(data).digest('hex');
assert.equal(sha(await fs.readFile(path.join(bundle, 'Contents', 'Resources', iconFile))), sha(await fs.readFile(icon)));
const payload = path.join(bundle, 'Contents', 'Resources', 'app');
const expected = new Set([...files.keys(), 'package.json']);
for (const entry of [pkg.main, 'dist/src/preload.js', 'renderer/index.html'])
  assert.ok(files.has(entry), `Ingresso runtime mancante: ${entry}`);
async function verify(dir, prefix = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name), full = path.join(dir, entry.name);
    if (entry.isDirectory()) await verify(full, relative);
    else {
      assert.equal(entry.isFile(), true, 'Payload senza symlink o file speciali');
      assert.ok(expected.delete(relative), `File inatteso nel payload: ${relative}`);
      if (files.has(relative)) assert.equal(sha(await fs.readFile(full)), files.get(relative), `Hash payload: ${relative}`);
    }
  }
}
await verify(payload);
assert.equal(expected.size, 0, 'Payload incompleto');
await fs.access(path.join(bundle, 'Contents', 'MacOS', 'clotch'), fs.constants.X_OK);
// Il bundle rinominato deve avere una firma ad hoc coerente, senza identità o Keychain.
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', bundle], { stdio: 'inherit' });
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
console.log('ADHOC_SIGNATURE_OK');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
await fs.writeFile(path.join(work, 'manifest.json'), JSON.stringify({ bundle, commit, electron: version,
  packager: pkg.devDependencies['@electron/packager'], iconSha256: sha(await fs.readFile(icon)),
  appBundleId: plist.CFBundleIdentifier, files: Object.fromEntries(files), signed: 'ad-hoc', notarized: false }, null, 2) + '\n');
console.log(`PACCHETTO_OK ${bundle}`);
console.log(`BUNDLE_ID ${plist.CFBundleIdentifier} NAME ${plist.CFBundleName} ICON_SHA256 ${sha(await fs.readFile(icon))}`);
console.log(`PAYLOAD_OK ${files.size + 1} file verificati, nessun node_modules o dato utente`);
