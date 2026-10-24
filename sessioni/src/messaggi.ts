// Messaggi di una sessione, a pagine dalla fine del file: un file di molti MB non si carica intero.
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { parseRiga, msgErrore } from "./jsonl";
import { Convertitore } from "./messaggi-claude";
import { ConvertitoreCodex, ConvertitoreCursor } from "./messaggi-altri";
import { Messaggio, PaginaMessaggi, Sessione } from "./tipi";

export const DIM_PAGINA = 50;

export const nuovoConvertitore = (s: Pick<Sessione, "sorgente">) =>
  s.sorgente === "codex" ? new ConvertitoreCodex() : s.sorgente === "cursor" ? new ConvertitoreCursor() : new Convertitore();

function converti(righe: string[], s: Pick<Sessione, "sorgente">): Messaggio[] {
  const c = nuovoConvertitore(s);
  return righe.flatMap((r) => {
    const o = parseRiga(r);
    return o ? c.riga(o).nuovi : [];
  });
}

export function leggiPagina(s: Pick<Sessione, "file" | "sorgente">, pagina: number, dim = DIM_PAGINA): PaginaMessaggi {
  const vuota = (errore: string | null): PaginaMessaggi => ({ messaggi: [], pagina, haAltre: false, errore, totale: null });
  if (!s.file.endsWith(".jsonl")) return vuota("trascrizione non trovata sul disco");
  let size: number;
  try {
    size = fs.statSync(s.file).size;
  } catch (e: any) {
    return vuota(msgErrore(e));
  }
  try {
    const servono = (pagina + 1) * dim + 1;
    let da = size, righe: string[] = [], resto = Buffer.alloc(0), blocco = 1 << 20;
    let messaggi: Messaggio[] = [];
    const fd = fs.openSync(s.file, "r");
    try {
      while (da > 0 && messaggi.length < servono) {
        const fine = da;
        da = Math.max(0, fine - blocco);
        // il resto resta in byte fino al join: un carattere UTF-8 a cavallo del blocco non si spezza in U+FFFD
        const buf = Buffer.concat([leggiByte(fd, da, fine - da), resto]);
        const a = da > 0 ? buf.indexOf(10) : -1; // la prima riga è tagliata: tocca al blocco prima, che la chiude
        resto = da > 0 ? (a < 0 ? buf : buf.subarray(0, a)) : Buffer.alloc(0);
        righe = (da > 0 && a < 0 ? [] : buf.toString("utf8", a + 1).split("\n")).concat(righe);
        messaggi = converti(righe, s);
        blocco *= 2; // doppio ogni giro: una pagina profonda non rilegge il file mille volte
      }
    } finally {
      fs.closeSync(fd);
    }
    const fineSlice = messaggi.length - pagina * dim;
    const inizio = Math.max(0, fineSlice - dim);
    return { messaggi: fineSlice > 0 ? messaggi.slice(inizio, fineSlice) : [], pagina, haAltre: inizio > 0 || da > 0, errore: null, totale: null };
  } catch (e: any) {
    return vuota(msgErrore(e));
  }
}

const firmaStat = (s: fs.BigIntStats) => `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
export const firmaFile = (file: string) => firmaStat(fs.statSync(file, { bigint: true }));

const CAMPIONE = 1024, CAMPIONI_MAX = 16, CAMPIONI_INIZIALI = 8;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
/** Finestra del prefisso già letto: se i suoi byte cambiano, il file è stato riscritto. */
export interface Campione { pos: number; len: number; hash: string }
export interface AncoraFile { identita: string; offset: number; campioni: Campione[] | null }
export type MotivoFile = "replace" | "truncate" | "riscrittura";

function leggiByte(fd: number, pos: number, len: number): Buffer {
  const b = Buffer.alloc(len);
  let n = 0;
  while (n < len) {
    const k = fs.readSync(fd, b, n, len - n, pos + n);
    if (!k) break;
    n += k;
  }
  return b.subarray(0, n);
}
/** `quante` finestre da CAMPIONE byte distribuite in [da, fine) (testa e coda incluse); con una sola, la coda. */
function campiona(dati: Buffer, da: number, fine: number, quante: number): Campione[] {
  const tot = fine - da, largo = Math.max(0, tot - CAMPIONE);
  if (tot <= 0) return [];
  const pos = new Set(Array.from({ length: quante }, (_, i) => da + Math.floor((quante > 1 ? i / (quante - 1) : 1) * largo)));
  return [...pos].map((p) => { const b = dati.subarray(p - da, Math.min(p + CAMPIONE, fine) - da); return { pos: p, len: b.length, hash: sha(b) }; });
}

/**
 * Versione validata del file: solo righe complete. Con un'ancora (stato già letto) controlla inode, dimensione e le finestre
 * campione del prefisso (al più CAMPIONI_MAX KiB) e legge solo dall'offset; senza ancora, o se il controllo fallisce, legge da 0.
 * `intero`: legge da 0 comunque (parser da riscaldare). Limite noto: una modifica in-place a stessa dimensione fuori dalle
 * finestre campione, con stesso inode, non si rileva.
 */
export function versioneFile(file: string, massimoByte = 64 * 1024 * 1024, ancora?: AncoraFile, intero = false) {
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const fd = fs.openSync(file, "r");
    try {
      const prima = fs.fstatSync(fd, { bigint: true }), identita = `${prima.dev}:${prima.ino}`;
      if (prima.size > BigInt(massimoByte)) throw new Error("Trascrizione troppo grande per la cronologia in memoria");
      let da = 0, motivo: MotivoFile | null = null;
      if (ancora) {
        motivo = ancora.identita !== identita ? "replace" : prima.size < BigInt(ancora.offset) ? "truncate"
          : !ancora.campioni || ancora.campioni.some((c) => sha(leggiByte(fd, c.pos, c.len)) !== c.hash) ? "riscrittura" : null;
        if (!motivo && !intero) da = ancora.offset;
      }
      const letti = leggiByte(fd, da, Number(prima.size) - da);
      const dopo = fs.fstatSync(fd, { bigint: true }), corrente = fs.statSync(file, { bigint: true });
      if (BigInt(da + letti.length) !== prima.size || [dopo, corrente].some((x) => x.dev !== prima.dev || x.ino !== prima.ino ||
        x.size !== prima.size || x.mtimeNs !== prima.mtimeNs || x.ctimeNs !== prima.ctimeNs)) continue;
      const dati = letti.subarray(0, letti.lastIndexOf(10) + 1), fine = da + dati.length;
      const campioni = da === 0 ? campiona(dati, 0, fine, CAMPIONI_INIZIALI) : [...ancora!.campioni!, ...campiona(dati, da, fine, 1)];
      return { dati, da, fine, motivo, identita, firma: firmaStat(prima),
        campioni: campioni.length > CAMPIONI_MAX ? campioni.filter((_, i) => i % 2 === 0 || i === campioni.length - 1) : campioni };
    } finally { fs.closeSync(fd); }
  }
  throw new Error("sorgente_instabile");
}

/** Ultima newline all'avvio: nessuna riga parziale va saltata dal primo evento. */
export function fineCompleta(file: string): number {
  const fd = fs.openSync(file, "r");
  try {
    let fine = fs.fstatSync(fd).size;
    while (fine > 0) {
      const inizio = Math.max(0, fine - 65536), b = Buffer.alloc(fine - inizio);
      const n = fs.readSync(fd, b, 0, b.length, inizio), i = b.subarray(0, n).lastIndexOf(10);
      if (i >= 0) return inizio + i + 1;
      fine = inizio;
    }
    return 0;
  } finally { fs.closeSync(fd); }
}

/** Adatta il parser senza usare ID nativi come identità della cronologia. */
export function lettoreCronologia(s: Pick<Sessione, "sorgente">) {
  const convertitore = nuovoConvertitore(s), pendenti = new Set<string>(), ambigui = new Set<string>();
  return (o: any): ReturnType<typeof convertitore.riga> => {
    let scollegati = 0;
    const nascita = (id: unknown) => {
      if (typeof id !== "string" || !id) return;
      if (pendenti.has(id)) ambigui.add(id);
      pendenti.add(id);
    };
    const esito = (id: unknown) => {
      const ok = typeof id === "string" && !!id && pendenti.has(id) && !ambigui.has(id);
      if (ok) pendenti.delete(id); else scollegati++;
      return ok;
    };
    if (s.sorgente === "claude-code" || s.sorgente === "claude-desktop") {
      if (o.isMeta) return convertitore.riga(o);
      if (Array.isArray(o.message?.content)) o.message.content = o.message.content.filter((b: any) => {
        if (b?.type === "tool_use") nascita(b.id);
        return b?.type !== "tool_result" || esito(b.tool_use_id);
      });
    } else if (s.sorgente === "codex" && o.type === "response_item") {
      const p = o.payload;
      if (p?.type === "function_call" || p?.type === "custom_tool_call") nascita(p.call_id);
      if ((p?.type === "function_call_output" || p?.type === "custom_tool_call_output") && !esito(p.call_id)) o = {};
    }
    if (s.sorgente === "codex" && o.type === "event_msg" && o.payload?.type === "item_completed") {
      const i = o.payload.item;
      if (i?.type === "McpToolCall") {
        if (ambigui.has(String(i.id))) { scollegati++; o = {}; }
        else if (pendenti.has(String(i.id))) esito(i.id);
      }
    }
    const r = convertitore.riga(o);
    if (scollegati) r.nuovi.push({ tipo: "errore", testo: "Risultato dello strumento non collegato: identificativo assente o ambiguo.", t: null });
    return r;
  };
}
