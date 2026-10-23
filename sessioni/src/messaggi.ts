// Messaggi di una sessione, a pagine dalla fine del file: un file di molti MB non si carica intero.
import * as fs from "node:fs";
import { parseRiga, leggiBlocco, msgErrore } from "./jsonl";
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
    let da = size, righe: string[] = [], resto = "", blocco = 1 << 20;
    let messaggi: Messaggio[] = [];
    while (da > 0 && messaggi.length < servono) {
      const fine = da;
      da = Math.max(0, fine - blocco);
      const parti = (leggiBlocco(s.file, da, fine) + resto).split("\n");
      resto = da > 0 ? parti.shift()! : ""; // la prima riga è tagliata: tocca al blocco prima, che la chiude
      righe = parti.concat(righe);
      messaggi = converti(righe, s);
      blocco *= 2; // doppio ogni giro: una pagina profonda non rilegge il file mille volte
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

/** Versione validata del file: solo righe complete, offset e identità fisica. */
export function versioneFile(file: string, massimoByte = 64 * 1024 * 1024) {
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const fd = fs.openSync(file, "r");
    try {
      const prima = fs.fstatSync(fd, { bigint: true });
      if (prima.size > BigInt(massimoByte)) throw new Error("Trascrizione troppo grande per la cronologia in memoria");
      const dati = Buffer.alloc(Number(prima.size));
      let letti = 0;
      while (letti < dati.length) {
        const n = fs.readSync(fd, dati, letti, dati.length - letti, letti);
        if (!n) break;
        letti += n;
      }
      const dopo = fs.fstatSync(fd, { bigint: true }), corrente = fs.statSync(file, { bigint: true });
      if (BigInt(letti) !== prima.size || [dopo, corrente].some((x) => x.dev !== prima.dev || x.ino !== prima.ino ||
        x.size !== prima.size || x.mtimeNs !== prima.mtimeNs || x.ctimeNs !== prima.ctimeNs)) continue;
      const fine = dati.lastIndexOf(10) + 1;
      return { dati: dati.subarray(0, fine), identita: `${prima.dev}:${prima.ino}`, firma: firmaStat(prima), dimensione: Number(prima.size) };
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
