// Registri scritti dagli hook di claude-config: obiettivi e stato vero delle sessioni. Solo lettura.
import * as fs from "node:fs";
import * as path from "node:path";
import { msgErrore } from "./jsonl";
import { ErroreLettura, Obiettivo, Stato } from "./tipi";

export interface StatoRegistro {
  cli: string;
  localId: string | null;
  stato: Stato;
  perche: string | null;
  visto: number | null;
}

/** Numero (secondi o millisecondi) o stringa ISO -> millisecondi; null se non è un tempo. */
export function aMillisecondi(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e11 ? v * 1000 : v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/** Ultimo contenuto letto per cartella: un file con la stessa firma non si rilegge; la mappa si rifà a ogni giro, quindi i file spariti escono. */
const cacheCartelle = new Map<string, Map<string, { chiave: string; dati: any }>>();

/** Legge tutti i `*.json` di una cartella; una cartella mancante non è un errore, una illeggibile sì. */
function leggiCartella(dir: string, errori: ErroreLettura[]): { chiave: string; dati: any }[] {
  let nomi: string[];
  try {
    nomi = fs.readdirSync(dir);
  } catch (e: any) {
    cacheCartelle.delete(dir);
    if (e.code !== "ENOENT") errori.push({ percorso: dir, messaggio: msgErrore(e) });
    return [];
  }
  const prima = cacheCartelle.get(dir), nuova = new Map<string, { chiave: string; dati: any }>();
  const out: { chiave: string; dati: any }[] = [];
  for (const n of nomi) {
    if (!n.endsWith(".json")) continue;
    const file = path.join(dir, n);
    try {
      const st = fs.statSync(file);
      const firma = `${st.ino}:${st.mtimeMs}:${st.ctimeMs}:${st.size}`; // come altre-sorgenti.ts: un file riscritto a pari mtime e misura si rilegge
      let e = prima?.get(n);
      if (!e || e.chiave !== firma) e = { chiave: firma, dati: JSON.parse(fs.readFileSync(file, "utf8")) };
      nuova.set(n, e);
      out.push({ chiave: n.slice(0, -5), dati: e.dati });
    } catch {
      // file a metà scrittura o rotto: si salta quel registro (e non si tiene in cache: al giro dopo si riprova)
    }
  }
  cacheCartelle.set(dir, nuova);
  return out;
}

const STATI: Record<string, Stato> = {
  lavora: "lavora",
  aspetta_roberto: "aspetta",
  aspetta_altro: "aspetta",
  ferma: "ferma",
  problema: "ferma",
};

/** Obiettivi per id CLI (`obiettivi/<cli>.json`). */
export function leggiObiettivi(radice: string, errori: ErroreLettura[]): Map<string, Obiettivo> {
  const m = new Map<string, Obiettivo>();
  for (const { chiave, dati } of leggiCartella(path.join(radice, "obiettivi"), errori)) {
    if (!dati || typeof dati !== "object") continue;
    const prove = Array.isArray(dati.prove)
      ? dati.prove.filter((p: any) => p && typeof p.testo === "string").map((p: any) => ({ testo: p.testo, fatta: p.fatta === true, fallita: p.fatta !== true && typeof p.nota === "string" && p.nota !== "" }))
      : [];
    m.set(String(dati.cli ?? chiave), {
      testo: String(dati.obiettivo ?? dati.titolo ?? ""),
      stato: String(dati.stato ?? "nessuno"),
      prove,
      valido: dati.valido !== false,
    });
  }
  return m;
}

/** Stato vero per id CLI (`sessioni-stato/<cli>.json`). */
export function leggiStati(radice: string, errori: ErroreLettura[]): Map<string, StatoRegistro> {
  const m = new Map<string, StatoRegistro>();
  for (const { chiave, dati } of leggiCartella(path.join(radice, "sessioni-stato"), errori)) {
    const stato = STATI[dati?.stato];
    if (!stato) continue;
    m.set(String(dati.cli ?? chiave), {
      cli: String(dati.cli ?? chiave),
      localId: typeof dati.local_id === "string" ? dati.local_id : null,
      stato,
      perche: typeof dati.perche === "string" ? dati.perche : null,
      visto: aMillisecondi(dati.visto),
    });
  }
  return m;
}
