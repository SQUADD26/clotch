#!/usr/bin/env node
// Contrasto WCAG 2.2 AA di ogni coppia testo/fondo, icona/fondo e fuoco/fondo, nei due modi di design/tokens.json (#1093).
// Soglie (sopra WCAG 2.2 AA, chiesto da Roberto): testo 4,8:1; icone e bordo del fuoco 3,3:1. Un colore con alfa si compone sul suo fondo.
//   node scripts/contrasto.mjs   stampa le coppie dalla peggiore, esce 1 se una è sotto soglia (lo lancia npm test)
// Un colore che non passa si corregge in Figma e si riesporta: mai qui.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODI, voci } from './token-css.mjs';

const tokens = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'design/tokens.json'), 'utf8'));
// soglie di Roberto («massima attenzione all'accessibilità dei colori»): margine sopra WCAG AA 4,5 e 3
const SOGLIA_TESTO = 4.8, SOGLIA_GRANDE = 3.3;
const ACCENTI = ['', '-blu', '-verde', '-viola', '-argento']; // Colore principale (aspetto.css)

const rgba = (h) => { const x = h.replace('#', ''); return [0, 2, 4, 6].map((i) => (i < x.length ? parseInt(x.slice(i, i + 2), 16) : 255)).map((v, i) => (i === 3 ? v / 255 : v)); };
// lo schermo compone in 8 bit: il fondo composto si arrotonda come lo disegna il motore
const sopra = (c, sotto) => c.slice(0, 3).map((v, i) => Math.round(v * c[3] + sotto[i] * (1 - c[3]))).concat(1);
const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const rapporto = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** Le coppie dell'app: [primo piano, fondo, base del fondo, soglia]. Fondi trasparenti si compongono sulla base (cornice o superficie). */
export function coppie() {
  const neutri = [['fondo-cornice'], ['fondo-superficie'], ['fondo-elevato'], ['fondo-casella', 'fondo-superficie'], ['fondo-codice', 'fondo-superficie'],
    ['fondo-riga-passaggio', 'fondo-cornice'], ['fondo-riga-passaggio', 'fondo-elevato'], ['fondo-riga-scelta', 'fondo-cornice'], ['fondo-riga-scelta', 'fondo-elevato'],
    ['fondo-bottone-secondario', 'fondo-superficie'], ['fondo-tabella-intestazione', 'fondo-superficie']];
  const testi = ['testo-primario', 'testo-secondario', 'testo-terziario', 'testo-errore', 'testo-successo', 'testo-link', 'testo-lavoro'];
  const icone = ['icona-primaria', 'icona-secondaria', 'icona-terziaria', 'icona-successo', 'icona-errore', 'icona-lavoro', 'icona-viola'];
  const c = [];
  for (const [f, b] of neutri) {
    for (const t of testi) c.push([t, f, b, SOGLIA_TESTO]);
    for (const i of [...icone, ...ACCENTI.map((a) => `icona-accento${a}`)]) c.push([i, f, b, SOGLIA_GRANDE]);
    for (const a of ACCENTI) c.push([`bordo-fuoco${a}`, f, b, SOGLIA_GRANDE]);
  }
  for (const a of ACCENTI) {
    c.push([`testo-bolla${a}`, `fondo-bolla${a}`, 'fondo-superficie', SOGLIA_TESTO]);
    c.push(['icona-su-accento', `fondo-accento${a}`, 'fondo-superficie', SOGLIA_GRANDE]);
    c.push(['testo-primario', `fondo-attesa${a}`, 'fondo-superficie', SOGLIA_TESTO]);
  }
  c.push(['testo-su-primario', 'fondo-bottone-primario', 'fondo-superficie', SOGLIA_TESTO], ['testo-errore', 'fondo-errore', 'fondo-superficie', SOGLIA_TESTO],
    ['icona-errore', 'fondo-errore', 'fondo-superficie', SOGLIA_GRANDE], ['testo-primario', 'fondo-errore', 'fondo-superficie', SOGLIA_TESTO]);
  return c;
}

export function misura() {
  const righe = [];
  for (const modo of MODI) {
    const v = voci(tokens, modo), col = (n) => { const x = v.get(`colore-${n}`); if (!x) throw new Error(`token mancante: colore/${n.replace(/-/g, '/')}`); return rgba(x.valore); };
    for (const [p, f, b, soglia] of coppie()) {
      const fondo = sopra(col(f), b ? col(b) : [0, 0, 0, 1]);
      const r = rapporto(sopra(col(p), fondo), fondo);
      righe.push({ modo, coppia: `${p} su ${f}${b ? ` (su ${b})` : ''}`, rapporto: +r.toFixed(2), soglia });
    }
  }
  return righe.sort((x, y) => x.rapporto / x.soglia - y.rapporto / y.soglia);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = misura(), sotto = r.filter((x) => x.rapporto < x.soglia);
  for (const x of r.slice(0, Math.max(15, sotto.length))) console.log(`${x.rapporto < x.soglia ? 'SOTTO' : 'ok   '} ${x.rapporto.toFixed(2)}:1 (soglia ${x.soglia}) ${x.modo.padEnd(6)} ${x.coppia}`);
  console.log(sotto.length ? `CONTRASTO_SOTTO ${sotto.length} di ${r.length}` : `CONTRASTO_OK ${r.length} coppie`);
  process.exit(sotto.length ? 1 : 0);
}
