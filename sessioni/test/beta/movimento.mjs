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
  const d = [], D = (criterio, a, valore) => d.push({ criterio, dove: a?.dove ?? dove, valore }), risposte = new Map();
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
      // lineare = sulla retta a metà e a un quarto (una curva ease-in-out simmetrica passa da 0,5 a metà, ma non da 0,25 a un quarto)
      const a_ = (f) => { const i = a.serie.findIndex((s) => s[0] >= t0 + a.durata * f); return i >= 0 ? p[i] : null; }, meta = a_(0.5), quarto = a_(0.25);
      if (a.durata > 100 && meta != null && Math.abs(meta - 0.5) < 0.08 && (quarto == null || Math.abs(quarto - 0.25) < 0.08)) D('M3', a, `a metà ${meta.toFixed(2)}: curva lineare (${a.curva})`);
    } else if (a.durata > 100 && a.curva === 'linear') D('M3', a, `curva dichiarata lineare (${a.nome})`);
    // M5 dal gesto che l'ha fatta partire: l'ultimo prima del suo primo fotogramma (premuto, clic o tasto). Il tempo di un fotogramma
    // è il suo inizio, di solito prima dell'evento che quel fotogramma disegna: si guarda fino a un fotogramma dopo.
    const parte = a.inizio ?? t0, gesto = (c.eventi ?? [c.evento]).filter((g) => g != null && parte != null && g <= parte + 1000 / 60).at(-1);
    // un avviso nasce dalla risposta del main, un tooltip dopo un'attesa voluta, sotto una View Transition non si vede: niente M5
    if (!a.avviso && !a.coperta && !a.attesa && gesto != null) { const r = risposte.get(gesto); if (!r || parte - gesto < r.ritardo) risposte.set(gesto, { a, ritardo: parte - gesto }); }
  }
  // M5 è «dal gesto al primo cambio»: conta la risposta più pronta a ogni gesto; ciò che si muove dopo (un bottone che torna
  // al riposo quando il layout si sposta, azioni al passaggio altrove) è una conseguenza, non la prontezza
  for (const { a, ritardo } of risposte.values()) if (ritardo > 50) D('M5', a, `parte ${Math.round(ritardo)} ms dopo il gesto`);
  const dt = c.T.slice(1).map((t, i) => t - c.T[i]).sort((a, b) => a - b);
  const fps = dt.length ? 1000 / dt[Math.floor(dt.length / 2)] : 60, lunghi = dt.filter((x) => x > 50).length;
  if (c.animazioni.length && (fps < 30 || lunghi >= 5)) D('M11', null, `mediana ${Math.round(fps)} fps, ${lunghi} fotogrammi oltre 50 ms`);
  return d;
}

/** M10: animazione interrotta a metà (Esc durante l'apertura). Rotto se tra due fotogrammi il valore salta oltre il 25% dell'escursione. */
export function difettiInterruzione(c, dove) {
  const d = [], gesto = c.eventi?.at(-1);
  // l'entrata del sovrapposto e la sua uscita (copia «.esce», base/Sovrapposto.tsx) sono lo stesso elemento: una serie sola
  const gruppi = new Map();
  for (const a of c.animazioni) { const k = (a.dove ?? dove).replace(/\.esce\b/, ''); gruppi.set(k, [...(gruppi.get(k) ?? []), ...a.serie]); }
  for (const [k, serie] of gruppi) {
    const s = serie.slice().sort((x, y) => x[0] - y[0]), op = s.map((x) => x[1]), lo = Math.min(...op), hi = Math.max(...op);
    if (hi - lo < 0.05 || op.length <= 2) continue;
    let salto;
    if (gesto == null) salto = Math.max(0, ...op.slice(1).map((v, i) => Math.abs(v - op[i]))) / (hi - lo);
    else {
      // salto = cambio tra l'ultimo fotogramma prima del gesto e il primo dopo, oltre il passo più lungo del moto intorno
      // (un'entrata veloce e decisa fa passi grandi da sé, specie a pochi fotogrammi al secondo: quelli non sono salti)
      const i = s.findIndex((x) => x[0] > gesto);
      if (i < 1) continue;
      // il passo di riferimento guarda anche il fotogramma dopo: un moto che accelera (uscita ease-in) non è un salto
      const prima = op.slice(0, i), dopo = op[i + 1] != null ? Math.abs(op[i + 1] - op[i]) : 0;
      const passo = Math.max(dopo, ...prima.slice(1).map((v, j) => Math.abs(v - prima[j])));
      const cambio = Math.abs(op[i] - op[i - 1]);
      salto = cambio > 1.5 * passo ? cambio / (hi - lo) : 0;
    }
    if (salto > 0.25) d.push({ criterio: 'M10', dove: k, valore: `salto del ${Math.round(salto * 100)}% tra due fotogrammi` });
  }
  return d;
}

/** Riassunto di un clic per il registro: una riga per animazione. */
export const riassunto = (c) => c.animazioni.map((a) => ({ dove: a.dove, nome: a.nome, proprieta: a.proprieta, durata: Math.round(a.durata), curva: a.curva, fotogrammi: a.serie.length }));
