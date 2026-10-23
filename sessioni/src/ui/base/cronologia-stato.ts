// Cronologia v1 del renderer: valori immutabili, nessun DOM, IPC o dedup per testo.
import type { DeltaCronologia, RigaCronologia, SnapshotPagina } from "../../cronologia-tipi";
import type { PaginaMessaggi } from "../../tipi";

export interface CronologiaStato {
  sessione: string | null;
  snapshot: SnapshotPagina | null;
  righe: Map<string, RigaCronologia>;
  overlay: Map<string, RigaCronologia>;
  buffer: DeltaCronologia[];
  sequenza: number | null;
  totale: number | null;
  cursore: string | null;
  pagina: number;
  errore: string | null;
  invalida: boolean;
}
const MAX_BUFFER = 10_000;
export const nuovaCronologia = (sessione: string | null): CronologiaStato => ({
  sessione, snapshot: null, righe: new Map(), overlay: new Map(), buffer: [],
  sequenza: null, totale: null, cursore: null, pagina: 0, errore: null, invalida: false,
});
export const righeOrdinate = (s: CronologiaStato) => [...s.righe.values()].sort((a, b) => a.ordine - b.ordine);
export const fallita = (s: CronologiaStato, errore: string, invalida = true): CronologiaStato => ({ ...s, errore, invalida });
const valida = (r: RigaCronologia) => typeof r.chiave === "string" && !!r.chiave && Number.isInteger(r.ordine) && r.ordine >= 0 && Number.isInteger(r.revisione) && r.revisione >= 0;
const copia = (r: RigaCronologia) => structuredClone(r);

export function applicaDelta(s: CronologiaStato, d: DeltaCronologia): CronologiaStato {
  if (d.sessione !== s.sessione || s.invalida) return s;
  if (!s.snapshot) {
    if (s.buffer.length >= MAX_BUFFER) return fallita(s, "Troppi aggiornamenti in attesa. Riprova.");
    return { ...s, buffer: [...s.buffer, structuredClone(d)] };
  }
  if (d.tipo === "errore") return d.epoca !== null && d.epoca !== s.snapshot.epoca ? s
    : fallita(s, d.errore.testo, d.errore.ripartenza === "nuova_snapshot");
  if (d.tipo === "reset") {
    if (d.epoca === s.snapshot.epoca) return s; // reset già incluso nella snapshot nuova
    return fallita(s, "La cronologia è cambiata. Riprova.");
  }
  if (d.epoca !== s.snapshot.epoca) return fallita(s, "La cronologia è cambiata. Riprova.");
  const seq = s.sequenza!;
  if (!Number.isInteger(d.daSeq) || !Number.isInteger(d.aSeq) || d.aSeq <= d.daSeq || d.daSeq < 0)
    return fallita(s, "Aggiornamento della cronologia non valido.");
  if (d.aSeq <= seq) return s;
  if (d.daSeq !== seq) return fallita(s, "Mancano aggiornamenti della cronologia. Riprova.");
  if (!Number.isInteger(d.totale) || d.totale < (s.totale ?? 0) || d.totale < s.righe.size || d.righe.some((r) => !valida(r) || r.revisione <= d.daSeq || r.revisione > d.aSeq))
    return fallita(s, "Aggiornamento della cronologia non valido.");
  const righe = new Map(s.righe), overlay = new Map(s.overlay);
  const minimo = [...s.righe.values()].reduce((min, r) => Math.min(min, r.ordine), Infinity);
  for (const r of d.righe) {
    const prima = overlay.get(r.chiave) ?? righe.get(r.chiave);
    if (prima && (prima.ordine !== r.ordine || prima.revisione > r.revisione))
      return fallita(s, "Identità della cronologia non valida.");
    const valore = copia(r);
    overlay.set(r.chiave, valore);
    if (righe.has(r.chiave) || r.ordine >= minimo || s.snapshot.totaleSnapshot === 0) righe.set(r.chiave, valore);
  }
  if (new Set([...overlay.values(), ...righe.values()].map((r) => `${r.ordine}:${r.chiave}`)).size !== new Set([...overlay.values(), ...righe.values()].map((r) => r.ordine)).size)
    return fallita(s, "Identità della cronologia non valida.");
  if (overlay.size > MAX_BUFFER) return fallita(s, "Troppi aggiornamenti in attesa. Riprova.");
  return { ...s, righe, overlay, sequenza: d.aSeq, totale: d.totale, errore: null };
}

export function applicaPagina(s: CronologiaStato, p: PaginaMessaggi): CronologiaStato {
  if (s.invalida) return s;
  if (p.erroreCronologia || p.errore)
    return fallita(s, p.erroreCronologia?.testo || p.errore!, p.erroreCronologia?.ripartenza !== "stessa_pagina");
  const c = p.cronologia;
  if (!c || c.v !== 1 || c.sessione !== s.sessione)
    return fallita(s, "Protocollo cronologia non disponibile.");
  if (!c.epoca || !c.snapshot || !Number.isInteger(c.watermark) || c.watermark < 0 ||
      !Number.isInteger(c.totaleSnapshot) || c.totaleSnapshot < c.righe.length || c.righe.some((r) => !valida(r) || r.revisione > c.watermark) || new Set(c.righe.map((r) => r.chiave)).size !== c.righe.length)
    return fallita(s, "Pagina della cronologia non valida.");
  if (s.snapshot && (c.epoca !== s.snapshot.epoca || c.snapshot !== s.snapshot.snapshot || c.watermark !== s.snapshot.watermark || c.totaleSnapshot !== s.snapshot.totaleSnapshot))
    return fallita(s, "La pagina non appartiene alla cronologia aperta. Riprova.");
  const righe = s.snapshot ? new Map(s.righe) : new Map<string, RigaCronologia>();
  for (const r of c.righe) {
    const prima = s.overlay.get(r.chiave) ?? righe.get(r.chiave);
    if (prima && prima.ordine !== r.ordine) return fallita(s, "Identità della cronologia non valida.");
    righe.set(r.chiave, s.overlay.get(r.chiave) ?? copia(r));
  }
  if (new Set([...righe.values()].map((r) => r.ordine)).size !== righe.size)
    return fallita(s, "Identità della cronologia non valida.");
  let prossimo: CronologiaStato = { ...s, snapshot: s.snapshot ?? structuredClone(c), righe,
    sequenza: s.sequenza ?? c.watermark, totale: s.totale ?? c.totaleSnapshot,
    cursore: c.cursorePrima, pagina: p.pagina, errore: null, buffer: [] };
  for (const d of s.buffer) {
    if (d.tipo === "upsert" && d.epoca !== c.epoca) continue;
    prossimo = applicaDelta(prossimo, d);
  }
  return prossimo;
}
