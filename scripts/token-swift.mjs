#!/usr/bin/env node
// design/tokens.json (variabili Figma, esportate con esporta-token.js della skill figma-ui-design) -> Sources/Clotch/FigmaTokens.swift.
//   node scripts/token-swift.mjs           riscrive il file Swift
//   node scripts/token-swift.mjs --check   esce 1 se il file Swift non è uguale a quello generato (lo lancia test-goals-linux.sh)
// Un valore nuovo si crea prima come variabile in Figma, poi si riesporta tokens.json e si rilancia questo script: mai a mano.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(root, 'design/tokens.json'), OUT = join(root, 'Sources/Clotch/FigmaTokens.swift');

// «macOS 27 · Golden Gate» -> MacOS27GoldenGate; «finestra/fondo» -> finestraFondo
// «_» resta: «raggio/1_5» diventa notchRaggio1_5, mai notchRaggio15 come «raggio/15»
const parole = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9_]+/).filter(Boolean);
const tipoSwift = p => p.map(w => w[0].toUpperCase() + w.slice(1)).join('').replace(/^\d/, '_$&');
const nomeSwift = p => { const n = tipoSwift(p); return n[0].toLowerCase() + n.slice(1); };

function colore(hex) {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) throw new Error(`colore non valido: ${hex}`);
  return m[2] ? `rgb(0x${m[1]}, ${+(parseInt(m[2], 16) / 255).toFixed(3)})` : `rgb(0x${m[1]})`;
}
function valore(t, v) {
  if (t === 'color') return ['Color', colore(v)];
  if (t === 'dimension') return ['CGFloat', String(parseFloat(v))];
  if (t === 'duration') return ['TimeInterval', String(parseFloat(v) / 1000)];
  if (t === 'number') return ['Double', String(v)];
  if (t === 'boolean') return ['Bool', String(v)];
  return ['String', JSON.stringify(String(v))];
}

export function genera(tokens) {
  const righe = [];
  for (const [col, modi] of Object.entries(tokens)) {
    if (col.startsWith('$')) continue;
    const nomiModi = Object.keys(modi).filter(m => !m.startsWith('$'));
    const usati = new Map(); // identificatore Swift -> nome Figma
    const voci = new Map(); // nome variabile -> {tipo, per modo: $value}
    const giu = (nodo, via, modo) => {
      for (const [k, f] of Object.entries(nodo)) {
        if (k.startsWith('$') || !f || typeof f !== 'object') continue;
        if ('$value' in f) { const n = [...via, k].join('/'); const v = voci.get(n) ?? { tipo: f.$type, modi: {} }; v.modi[modo] = f.$value; voci.set(n, v); }
        else giu(f, [...via, k], modo);
      }
    };
    for (const m of nomiModi) giu(modi[m], [], m);
    righe.push(`    /// Collezione Figma «${col}».`, `    enum ${tipoSwift(parole(col))} {`);
    for (const [n, { tipo, modi: per }] of voci) {
      const valori = nomiModi.map(m => per[m]);
      const id = nomeSwift(parole(n));
      if (usati.has(id)) throw new Error(`«${n}» e «${usati.get(id)}» diventano entrambe ${id} in Swift: rinomina una delle due in Figma`);
      usati.set(id, n);
      if (new Set(valori).size === 1) { const [t, v] = valore(tipo, valori[0]); righe.push(`        static let ${id}: ${t} = ${t === 'Color' ? `Color(nsColor: ${v})` : v}  // ${n}`); }
      else if (tipo === 'color' && nomiModi.length === 2 && nomiModi.includes('Chiaro') && nomiModi.includes('Scuro'))
        righe.push(`        static let ${id} = coppia(chiaro: ${colore(per.Chiaro)}, scuro: ${colore(per.Scuro)})  // ${n}`);
      else throw new Error(`«${n}» cambia tra i modi ${nomiModi.join(', ')}: solo i colori Chiaro/Scuro sono gestiti`);
    }
    righe.push('    }');
  }
  return `// Generato da scripts/token-swift.mjs da design/tokens.json (variabili del file Figma Clotch): non si modifica a mano.
// Un valore nuovo si crea prima come variabile in Figma, poi si riesportano i token (skill figma-ui-design, fase 10).
import AppKit
import SwiftUI

enum FigmaToken {
${righe.join('\n')}
}

private func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat(hex >> 16 & 0xff) / 255, green: CGFloat(hex >> 8 & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: alpha)
}

/// Il modo Figma «Chiaro» o «Scuro» secondo l'aspetto in uso.
private func coppia(chiaro: NSColor, scuro: NSColor) -> Color {
    Color(nsColor: NSColor(name: nil) { $0.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? scuro : chiaro })
}
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const nuovo = genera(JSON.parse(readFileSync(IN, 'utf8')));
  if (process.argv.includes('--check')) {
    let vecchio = '';
    try { vecchio = readFileSync(OUT, 'utf8'); } catch {}
    if (vecchio !== nuovo) { console.error('FigmaTokens.swift non è uguale a design/tokens.json: lancia node scripts/token-swift.mjs'); process.exit(1); }
    console.log('FigmaTokens.swift allineato a design/tokens.json');
  } else { writeFileSync(OUT, nuovo); console.log('scritto Sources/Clotch/FigmaTokens.swift'); }
}
