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
  const vuota = (errore: string | null): PaginaMessaggi => ({ messaggi: [], pagina, haAltre: false, errore });
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
    return { messaggi: fineSlice > 0 ? messaggi.slice(inizio, fineSlice) : [], pagina, haAltre: inizio > 0 || da > 0, errore: null };
  } catch (e: any) {
    return vuota(msgErrore(e));
  }
}
