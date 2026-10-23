#!/usr/bin/env node
// design/icone.json (forme dei componenti «Icona/*» del file Figma, lette col ponte figma-console) -> src/ui/base/icone.ts.
//   node scripts/icone.mjs           riscrive il file
//   node scripts/icone.mjs --check   esce 1 se il file non è uguale a quello generato (lo lancia npm test)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(root, 'design/icone.json'), OUT = join(root, 'src/ui/base/icone.ts');

export function genera(icone) {
  const righe = Object.entries(icone).filter(([k]) => !k.startsWith('$')).sort(([a], [b]) => a.localeCompare(b))
    .map(([nome, [x, y, , , tracciati]]) => `  "${nome}": { x: ${x}, y: ${y}, tracciati: [${tracciati
      .map(([r, d]) => `{ pari: ${r === 'EVENODD'}, d: "${d}" }`).join(', ')}] },`);
  return '// Generato da scripts/icone.mjs da design/icone.json: non si modifica a mano.\n' +
    'export interface Forma { x: number; y: number; tracciati: { pari: boolean; d: string }[] }\n' +
    `export const icone = {\n${righe.join('\n')}\n} satisfies Record<string, Forma>;\n\nexport type NomeIcona = keyof typeof icone;\n`;
}

const ts = genera(JSON.parse(readFileSync(IN, 'utf8')));
if (process.argv.includes('--check')) {
  let vecchio = ''; try { vecchio = readFileSync(OUT, 'utf8'); } catch {}
  if (vecchio !== ts) { console.error(`icone non aggiornate: ${OUT}. Lancia: node scripts/icone.mjs`); process.exit(1); }
  console.log('icone: ok');
} else { writeFileSync(OUT, ts); console.log(`icone: ${OUT}`); }
