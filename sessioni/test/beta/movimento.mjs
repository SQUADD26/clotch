// Misura del movimento (#518): dai campioni a ogni fotogramma di sonde.js (`__bt.campiona`) ai difetti dei criteri di movimento.
// M2 durata = un token tempo/* (±25 ms o ±15%); M3 mai lineare (a metà durata il progresso sta fuori da 0,50 ± 0,08); M5 parte entro 50 ms;
// M8 con movimento ridotto niente si sposta o scala e niente gira all'infinito; M10 interrotta a metà non salta più del 25%;
// M11 fluida (headless: rotta sotto 30 fps di mediana o con 5 fotogrammi oltre 50 ms); MLAYOUT si animano solo transform e opacity.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RADICE } from './avvio.mjs';

const css = readFileSync(join(RADICE, 'src/ui/base/token.css'), 'utf8');
export const TEMPI = [...css.matchAll(/--tempo-[\w-]+:\s*([\d.]+)ms/g)].map((m) => +m[1]);
const LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|max-|min-|flex-basis|grid-template)/;
const MOSSA = /^(transform|translate|scale|rotate)$/;

// Progresso 0..1 della proprietà che cambia di più (opacità o spostamento o scala) lungo la serie.
function progresso(serie) {
  // escursione confrontabile: opacità e scala così come sono, spostamento in centinaia di px
  const [c] = [[1, 1], [2, 100], [3, 100], [4, 1]].map(([i, k]) => { const v = serie.map((s) => s[i]); return { v, d: Math.abs(v.at(-1) - v[0]) / k }; }).sort((a, b) => b.d - a.d);
  const a = c.v[0], b = c.v.at(-1);
  return Math.abs(b - a) < 1e-3 ? null : c.v.map((x) => (x - a) / (b - a));
}

/** Difetti di un clic campionato. `c`: risultato di __bt.campiona; `ridotto`: prefers-reduced-motion attivo. */
export function difettiMovimento(c, { ridotto = false, dove = '' } = {}) {
  const d = [], D = (criterio, a, valore) => d.push({ criterio, dove: a?.dove ?? dove, valore });
  for (const a of c.animazioni) {
    // il gruppo di una View Transition (base/movimento.css, #520) cambia misura alla foto, fuori dalla pagina: nessun ricalcolo del layout
    const lay = /::view-transition-group\(/.test(a.dove) ? [] : a.proprieta.filter((p) => LAYOUT.test(p));
    if (lay.length) D('MLAYOUT', a, `anima ${lay.join(', ')}`);
    if (ridotto && (a.infinita || a.proprieta.some((p) => MOSSA.test(p)))) {
      const s = a.serie, mosso = s.some((x) => Math.hypot(x[2] - s[0][2], x[3] - s[0][3]) > 0.5 || Math.abs(x[4] - s[0][4]) > 0.005);
      if (a.infinita || mosso) { D('M8', a, a.infinita ? `animazione infinita «${a.nome}»` : `${a.nome} si sposta con movimento ridotto`); continue; }
    }
    if (a.infinita || !(a.durata > 0)) continue;
    if (!TEMPI.some((t) => Math.abs(a.durata - t) <= Math.max(25, t * 0.15))) D('M2', a, `${Math.round(a.durata)} ms, token ${TEMPI.join('/')} ms (${a.nome})`);
    const p = a.serie.length >= 6 ? progresso(a.serie) : null, t0 = a.serie[0]?.[0];
    if (p) {
      const i = a.serie.findIndex((s) => s[0] >= t0 + a.durata / 2), meta = i >= 0 ? p[i] : null;
      if (a.durata > 100 && meta != null && Math.abs(meta - 0.5) < 0.08) D('M3', a, `a metà ${meta.toFixed(2)}: curva lineare (${a.curva})`);
    } else if (a.durata > 100 && a.curva === 'linear') D('M3', a, `curva dichiarata lineare (${a.nome})`);
    // M5 dal gesto che l'ha fatta partire: l'ultimo prima del suo primo fotogramma (premuto, clic o tasto)
    const gesto = (c.eventi ?? [c.evento]).filter((g) => g != null && t0 != null && g <= t0).at(-1);
    // un avviso a comparsa nasce dalla risposta del main, non dal gesto: la sua partenza non misura la prontezza
    if (!a.avviso && gesto != null && t0 - gesto > 50) D('M5', a, `parte ${Math.round(t0 - gesto)} ms dopo il gesto`);
  }
  const dt = c.T.slice(1).map((t, i) => t - c.T[i]).sort((a, b) => a - b);
  const fps = dt.length ? 1000 / dt[Math.floor(dt.length / 2)] : 60, lunghi = dt.filter((x) => x > 50).length;
  if (c.animazioni.length && (fps < 30 || lunghi >= 5)) D('M11', null, `mediana ${Math.round(fps)} fps, ${lunghi} fotogrammi oltre 50 ms`);
  return d;
}

/** M10: animazione interrotta a metà (Esc durante l'apertura). Rotto se tra due fotogrammi il valore salta oltre il 25% dell'escursione. */
export function difettiInterruzione(c, dove) {
  const d = [];
  for (const a of c.animazioni) {
    const op = a.serie.map((s) => s[1]), lo = Math.min(...op), hi = Math.max(...op);
    if (hi - lo < 0.05) continue;
    const salto = Math.max(0, ...op.slice(1).map((v, i) => Math.abs(v - op[i]))) / (hi - lo);
    if (salto > 0.25 && op.length > 2) d.push({ criterio: 'M10', dove: a.dove ?? dove, valore: `salto del ${Math.round(salto * 100)}% tra due fotogrammi` });
  }
  return d;
}

/** Riassunto di un clic per il registro: una riga per animazione. */
export const riassunto = (c) => c.animazioni.map((a) => ({ dove: a.dove, nome: a.nome, proprieta: a.proprieta, durata: Math.round(a.durata), curva: a.curva, fotogrammi: a.serie.length }));
