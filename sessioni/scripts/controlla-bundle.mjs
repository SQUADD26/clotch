// Confine del renderer (#447): nel bundle non entra niente di Node, di Electron o del main clotch AI.
// Un modulo Node importato dal renderer viene "externalized" da Vite e sparisce dal codice: lo si vede solo nei
// warning della build, quindi qui si ricostruisce in una cartella temporanea ascoltandoli, oltre a leggere renderer/.
// Uso: npm run build && node scripts/controlla-bundle.mjs     Stampa BUNDLE_OK oppure l'elenco e esce 1.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const NODE = 'node:[\\w/]+|fs|path|os|child_process|electron|crypto|net|http|https|stream|util|url|zlib|vm|module|worker_threads|readline|dns|tls|events|buffer|process';
const SCHEMI = [
  [new RegExp(`\\b(?:require|import)\\s*\\(\\s*["'\`](?:${NODE})(?:/[\\w/]*)?["'\`]\\s*\\)`, 'g'), 'import dinamico o require di un modulo Node'],
  [new RegExp(`\\bfrom\\s*["'](?:${NODE})(?:/[\\w/]*)?["']`, 'g'), 'import statico di un modulo Node'],
  [/\.\.\/\.\.\/clotch-ai["'`]|\/src\/clotch-ai(?:\.ts)?["'`]/g, 'import del main clotch AI'],
  [/__vite-browser-external/g, 'modulo Node sostituito da Vite'],
];
const trova = (codice, dove) => SCHEMI.flatMap(([re, cosa]) => [...codice.matchAll(re)].map((m) => `${dove}: ${cosa}: ${m[0].slice(0, 80)}`));
const soloWarn = (lista) => ({ info() {}, warn: (m) => { if (/externalized for browser compatibility/.test(m)) lista.push(`${(m.match(/Module "([^"]+)"/) ?? [])[1] ?? '?'} importato dal renderer (warning di build)`); },
  warnOnce() {}, error: (m) => lista.push(`errore di build: ${m.slice(0, 120)}`), clearScreen() {}, hasErrorLogged: () => false, hasWarned: false });

async function ricostruisci(opzioni) {
  const trovati = [];
  const r = await build({ logLevel: 'warn', customLogger: soloWarn(trovati), ...opzioni });
  for (const o of [r].flat().flatMap((x) => x.output ?? [])) if (o.type === 'chunk') trovati.push(...trova(o.code, `chunk ${o.fileName}`));
  return trovati;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clotch-bundle-'));
try {
  // controllo positivo: se il rilevatore non vede un `import fs` vero, un BUNDLE_OK non vale niente
  fs.writeFileSync(path.join(tmp, 'entry.js'), 'import { readFileSync } from "node:fs";\nimport { join } from "path";\nconsole.log(readFileSync, join);\n');
  const finto = await ricostruisci({ root: tmp, configFile: false, build: { outDir: path.join(tmp, 'out'), lib: { entry: path.join(tmp, 'entry.js'), formats: ['es'], fileName: () => 'b.js' } } });
  if (!finto.length) { console.log('BUNDLE_CONTROLLO_POSITIVO_FALLITO: un import di node:fs non viene rilevato'); process.exit(1); }
  console.log(`BUNDLE_CONTROLLO_POSITIVO_OK: ${finto.length} segnalazioni sul bundle finto`);

  const problemi = [];
  const dist = path.join(root, 'renderer');
  const file = fs.existsSync(dist) ? fs.readdirSync(dist, { recursive: true }).map(String).filter((f) => /\.(js|html|css)$/.test(f)) : [];
  if (!file.some((f) => f.endsWith('.js'))) problemi.push('renderer/ senza bundle: prima npm run build');
  for (const f of file) problemi.push(...trova(fs.readFileSync(path.join(dist, f), 'utf8'), `renderer/${f}`));
  problemi.push(...await ricostruisci({ root: path.join(root, 'src/ui'), configFile: path.join(root, 'vite.config.mjs'), build: { outDir: path.join(tmp, 'renderer'), emptyOutDir: true } }));
  if (problemi.length) { console.log(`BUNDLE_NON_OK (${problemi.length}):\n${[...new Set(problemi)].map((p) => '  - ' + p).join('\n')}`); process.exit(1); }
  console.log(`BUNDLE_OK: ${file.filter((f) => f.endsWith('.js')).length} file js in renderer/, nessun modulo Node, electron o main clotch AI; la ricostruzione non segnala moduli esternalizzati`);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
