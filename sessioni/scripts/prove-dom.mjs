// Esegue in serie tutte le prove con finestra (test/*.dom.cjs) e la prova del main in VM (test/parita-invisibile.cjs).
// Silenzioso: CLOTCH_TEST_SILENT=1, dati utente in una cartella temporanea, un solo Electron alla volta (lock condiviso).
// Uso: node scripts/prove-dom.mjs [pezzo-del-nome ...]   Uscita: 0 tutto verde, 2 solo difetti noti aperti, 1 prove rotte.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const LOCK = '/tmp/clotch-electron.lock';
const filtri = process.argv.slice(2);
const mancano = ['dist/src/preload.js', 'renderer/index.html', 'node_modules/.bin/electron'].filter((f) => !fs.existsSync(path.join(root, f)));
if (mancano.length) { console.error(`Manca ${mancano.join(', ')}: prima npm ci e npm run build.`); process.exit(1); }

const dir = path.join(root, 'test');
const prove = fs.readdirSync(dir).filter((f) => f.endsWith('.dom.cjs')).sort()
  .map((f) => ({ f, electron: true })).concat(fs.existsSync(path.join(dir, 'parita-invisibile.cjs')) ? [{ f: 'parita-invisibile.cjs', electron: false }] : [])
  .filter((p) => !filtri.length || filtri.some((x) => p.f.includes(x)));

const prendiLock = () => { for (;;) { try { fs.mkdirSync(LOCK); return; } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000); } } };
const rilasciaLock = () => { try { fs.rmdirSync(LOCK); } catch { /* già rilasciato */ } };
let inLock = false;
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { if (inLock) rilasciaLock(); process.exit(130); });

const dati = fs.mkdtempSync(path.join(os.tmpdir(), 'clotch-prove-dom-'));
const righe = [];
for (const p of prove) {
  const file = path.join(dir, p.f);
  const env = { ...process.env, CLOTCH_TEST_SILENT: '1', HOME: dati };
  const t0 = Date.now();
  let r;
  if (p.electron) {
    prendiLock(); inLock = true;
    try { r = spawnSync(path.join(root, 'node_modules/.bin/electron'), [`--user-data-dir=${path.join(dati, p.f)}`, file], { cwd: root, env, encoding: 'utf8', timeout: 240000, maxBuffer: 64 << 20 }); }
    finally { rilasciaLock(); inLock = false; }
  } else r = spawnSync(process.execPath, [file], { cwd: root, env, encoding: 'utf8', timeout: 240000, maxBuffer: 64 << 20 });
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const sf = out.match(/shows?=(\d+)\s+focus=(\d+)/);
  const stato = r.status === 0 ? 'OK' : r.status === 2 ? 'DIFETTI_APERTI' : 'FAIL';
  const aperti = [...out.matchAll(/^DEFECT_OPEN (\S+) \[([^\]]+)\]/gm)].map((m) => m[2]);
  const fallite = [...out.matchAll(/^FAIL (.+)$/gm)].map((m) => m[1].slice(0, 160));
  // le prove senza finestra reale (VM) o che contano solo show: lo dicono invece di inventare un numero
  const mostra = sf ? `show=${sf[1]} focus=${sf[2]}` : /EXTERNAL_HIDDEN_WINDOWS_OK/.test(out) ? 'show=0 focus=n/d' : p.electron ? 'show=? focus=?' : 'show=n/a focus=n/a (VM)';
  const marker = (out.match(/^(PERCORSI_RIEPILOGO|SICUREZZA_RIEPILOGO).*$/m) ?? [''])[0];
  righe.push({ stato, f: p.f, mostra });
  console.log(`${stato.padEnd(14)} ${p.f.padEnd(34)} ${mostra.padEnd(26)} ${((Date.now() - t0) / 1000).toFixed(1)}s${marker ? '  ' + marker : ''}`);
  for (const d of aperti) console.log(`    difetto aperto: ${d}`);
  for (const x of fallite) console.log(`    FAIL ${x}`);
  if (stato === 'FAIL' && !fallite.length) console.log(`    uscita ${r.status ?? r.signal}: ${out.trim().split('\n').slice(-6).join(' | ').slice(0, 400)}`);
}
fs.rmSync(dati, { recursive: true, force: true });
const rotte = righe.filter((r) => r.stato === 'FAIL').length, aperte = righe.filter((r) => r.stato === 'DIFETTI_APERTI').length;
console.log(`PROVE_DOM file=${righe.length} ok=${righe.filter((r) => r.stato === 'OK').length} difetti_aperti=${aperte} fail=${rotte}`);
process.exit(rotte ? 1 : aperte ? 2 : 0);
