// Numeri del pannello «Info sessione» che la trascrizione di Claude Code dà: contesto dopo l'ultima risposta e file toccati.
// Si legge una volta tutto il file, poi solo le righe nuove (offset per file).
import * as fs from "node:fs";
import { parseRiga, righeNuove } from "./jsonl";
import type { InfoSessione, Sessione } from "./tipi";

interface Conto { offset: number; contesto: number | null; file: Set<string>; aggiunte: number; tolte: number }
const conti = new Map<string, Conto>();

const righe = (v: unknown) => (typeof v === "string" && v ? v.replace(/\n$/, "").split("\n") : []);

/** Righe aggiunte e tolte da una modifica: le righe uguali in testa e in coda non contano (come il diff della chat). */
function differenza(vecchio: unknown, nuovo: unknown): [number, number] {
  const v = righe(vecchio), n = righe(nuovo);
  let a = 0; while (a < v.length && a < n.length && v[a] === n[a]) a++;
  let z = 0; while (z < v.length - a && z < n.length - a && v[v.length - 1 - z] === n[n.length - 1 - z]) z++;
  return [n.length - a - z, v.length - a - z];
}

function leggiRiga(c: Conto, riga: string) {
  if (!riga.includes('"assistant"')) return; // la sola riga che porta conteggio e strumenti
  const o = parseRiga(riga);
  if (o?.type !== "assistant" || o.isSidechain || !o.message) return;
  const u = o.message.usage;
  if (u && typeof u.input_tokens === "number") c.contesto = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0);
  for (const b of Array.isArray(o.message.content) ? o.message.content : []) {
    if (b?.type !== "tool_use" || typeof b.input?.file_path !== "string") continue;
    const i = b.input;
    const coppie: [unknown, unknown][] = b.name === "Write" ? [["", i.content]]
      : b.name === "MultiEdit" && Array.isArray(i.edits) ? i.edits.map((e: any): [unknown, unknown] => [e?.old_string, e?.new_string])
      : b.name === "Edit" ? [[i.old_string, i.new_string]] : [];
    if (!coppie.length) continue;
    c.file.add(i.file_path);
    for (const [v, n] of coppie) { const [piu, meno] = differenza(v, n); c.aggiunte += piu; c.tolte += meno; }
  }
}

const VUOTA: InfoSessione = { contesto: null, file: { quanti: 0, aggiunte: 0, tolte: 0 } };

export function infoSessione(s: Sessione | undefined): InfoSessione {
  if (!s || !s.file.endsWith(".jsonl") || (s.sorgente !== "claude-code" && s.sorgente !== "claude-desktop")) return VUOTA;
  try {
    let c = conti.get(s.file);
    if (!c || fs.statSync(s.file).size < c.offset) conti.set(s.file, c = { offset: 0, contesto: null, file: new Set(), aggiunte: 0, tolte: 0 });
    const { righe: nuove, offset } = righeNuove(s.file, c.offset);
    for (const r of nuove) leggiRiga(c, r);
    c.offset = offset;
    return { contesto: c.contesto, file: { quanti: c.file.size, aggiunte: c.aggiunte, tolte: c.tolte } };
  } catch {
    return VUOTA; // file sparito o illeggibile: il pannello nasconde le due sezioni, non mostra numeri finti
  }
}
