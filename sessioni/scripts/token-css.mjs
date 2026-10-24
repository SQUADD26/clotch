#!/usr/bin/env node
// design/tokens.json (variabili Figma, esporta-token.js della skill figma-ui-design) -> variabili CSS e tipi del renderer.
//   node scripts/token-css.mjs           riscrive src/ui/base/token.css e src/ui/base/token.ts
//   node scripts/token-css.mjs --check   esce 1 se i file non sono uguali a quelli generati (lo lancia npm test)
// Un valore nuovo nasce come variabile in Figma, poi si riesporta tokens.json: mai a mano.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(root, 'design/tokens.json');
const CSS = join(root, 'src/ui/base/token.css'), TS = join(root, 'src/ui/base/token.ts');
// «SF Pro» in Figma è il font di sistema del Mac: Chromium lo trova solo come -apple-system.
const FAMIGLIA = { 'SF Pro': '"SF Pro", -apple-system, system-ui', Menlo: 'Menlo, monospace',
  'SF Pro Rounded': 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui', 'SF Mono': 'ui-monospace, "SF Mono", Menlo, monospace' };

export function voci(tokens, i = 0) {
  const out = new Map(); // nome CSS -> {tipo, valore}
  for (const [col, modi] of Object.entries(tokens)) {
    if (col.startsWith('$')) continue;
    const modo = Object.keys(modi).filter((m) => !m.startsWith("$"))[i]; // 0 = scuro (i token base), 1 = chiaro (solo i valori che cambiano)
    if (!modo) continue;
    const giu = (nodo, via) => {
      for (const [k, f] of Object.entries(nodo)) {
        if (k.startsWith('$') || !f || typeof f !== 'object') continue;
        const p = [...via, k];
        if ('$value' in f) out.set(p.join('-').replace(/\./g, '_'), { tipo: f.$type, valore: f.$value });
        giu(f, p);
      }
    };
    giu(modi[modo], []);
  }
  return out;
}

export function genera(tokens) {
  const v = voci(tokens);
  const testa = '/* Generato da scripts/token-css.mjs da design/tokens.json: non si modifica a mano. */\n';
  const css = testa + ':root {\n' + [...v].map(([n, { tipo, valore }]) =>
    `  --${n}: ${tipo === 'string' ? FAMIGLIA[valore] ?? JSON.stringify(valore) : valore};`).join('\n') + '\n}\n' +
    // tema chiaro: solo i valori che cambiano rispetto allo scuro; si accende con data-tema="chiaro" sulla radice
    ':root[data-tema="chiaro"] {\n' + [...voci(tokens, 1)].filter(([n, x]) => v.get(n)?.valore !== x.valore)
      .map(([n, { valore }]) => `  --${n}: ${valore};`).join('\n') + '\n}\n';
  const ts = testa.replace('/*', '//').replace(' */', '') +
    `export type Token =\n${[...v.keys()].map((n) => `  | "${n}"`).join('\n')};\n\n` +
    '/** `var(--nome)` da usare negli stili in linea. */\nexport const t = (n: Token) => `var(--${n})`;\n\n' +
    '/** Valori grezzi («4px», «#232323», «200ms») per chi non legge il CSS: processo main, calcoli. */\n' +
    `export const valori: Record<Token, string> = {\n${[...v].map(([n, x]) => `  "${n}": ${JSON.stringify(String(x.valore))},`).join('\n')}\n};\n` +
    '/** Numero di un token in px o ms. */\nexport const numero = (n: Token) => parseFloat(valori[n]);\n';
  return { css, ts };
}

const { css, ts } = genera(JSON.parse(readFileSync(IN, 'utf8')));
if (process.argv.includes('--check')) {
  const vecchi = [CSS, TS].filter((f, i) => { try { return readFileSync(f, 'utf8') !== [css, ts][i]; } catch { return true; } });
  if (vecchi.length) { console.error(`token non aggiornati: ${vecchi.join(', ')}. Lancia: node scripts/token-css.mjs`); process.exit(1); }
  console.log('token: ok');
} else {
  writeFileSync(CSS, css); writeFileSync(TS, ts);
  console.log(`token: ${CSS}, ${TS}`);
}
