// Valori ammessi per le sonde (#518): colori, raggi e spazi di src/ui/base/token.css (generato da design/tokens.json, fonte Figma).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RADICE } from './avvio.mjs';

const hex = (h) => { const x = h.slice(1); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)).concat(x.length === 8 ? +(parseInt(x.slice(6), 16) / 255).toFixed(3) : 1); };

export function tokenPagina(file = join(RADICE, 'src/ui/base/token.css')) {
  const v = [...readFileSync(file, 'utf8').matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
  const px = (pre) => [...new Set(v.filter(([n, x]) => n.startsWith(pre) && /^[\d.]+px$/.test(x)).map(([, x]) => parseFloat(x)))];
  return {
    colori: v.filter(([, x]) => /^#([\da-f]{6}|[\da-f]{8})$/i.test(x)).map(([, x]) => hex(x)),
    raggi: px('raggio-'),
    spazi: px('spazio-'),
    // il CSS costruito, per leggere i valori scritti (es. `auto`): da file:// la pagina non può leggere i suoi fogli
    css: readdirSync(join(RADICE, 'renderer/assets')).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(RADICE, 'renderer/assets', f), 'utf8')).join('\n'),
  };
}
