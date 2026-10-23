// Scene di prova per la parità (#362): `npm run parita -- <id>` con design/scene/<id>.json. Il main risponde ai canali
// coi dati del disegno al posto di quelli del Mac; la finestra parte dalla vista della scena. Un file per frame.
import * as fs from "node:fs";
import * as path from "node:path";
import type { IpcMain } from "electron";
import { leggiRegistro } from "./friday";
import { piano } from "./friday-ipc";
import type { Archiviata, CartellaAccount, Elenco, Messaggio, PaginaMessaggi, PreferenzeSessione, QuotaUso } from "./tipi";
import { DIM_PAGINA } from "./messaggi";

export interface Scena {
  /** Vista di partenza, come `useNavigazione()`: vista, sessione scelta, sezione. */
  navigazione?: { vista: string; sessione?: string; sezione?: string };
  elenco?: Elenco;
  /** Messaggi per id di sessione, in ordine di tempo. */
  messaggi?: Record<string, Messaggio[]>;
  preferenze?: Record<string, PreferenzeSessione>;
  impostazioni?: Record<string, unknown>;
  /** Impostazioni (#351): cartelle degli account come le dà il main, quote d'uso, archiviate, spazio, versione. */
  cartelle?: CartellaAccount[];
  uso?: QuotaUso[];
  archiviate?: Archiviata[];
  spazio?: { indice: number; messaggi: number; immagini: number };
  versione?: string;
  /** Registro di Friday come lo dà `friday:registro`. */
  registro?: unknown;
}

export const fileScena = (radice: string, id: string) => path.join(radice, "design", "scene", `${id}.json`);
export const leggiScena = (file: string): Scena | null => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

/** Risposta di un canale IPC dalla scena; i canali che scrivono non fanno niente. */
export function rispostaScena(s: Scena, canale: string, args: unknown[]): unknown {
  switch (canale) {
    case "sessioni:elenco": return s.elenco ?? { sessioni: [], errori: [] };
    case "sessioni:messaggi": {
      const tutti = s.messaggi?.[String(args[0])] ?? [], p = Number(args[1]) | 0;
      const fine = tutti.length - p * DIM_PAGINA;
      return { messaggi: tutti.slice(Math.max(0, fine - DIM_PAGINA), Math.max(0, fine)), pagina: p, haAltre: fine - DIM_PAGINA > 0, errore: null, totale: tutti.length } satisfies PaginaMessaggi;
    }
    case "sessioni:preferenze": return s.preferenze ?? {};
    case "sessioni:impostazioni": return s.impostazioni ?? {};
    case "sessioni:cerca": return [];
    case "sessioni:spazio": return s.spazio ?? { indice: 0, messaggi: 0, immagini: 0 };
    case "impostazioni:radici": return (s.cartelle ?? []).map((c) => c.percorso);
    case "impostazioni:cartelle": return (s.cartelle ?? []).filter((c) => (args[0] as string[]).includes(c.percorso));
    case "impostazioni:versione": return s.versione ?? "";
    case "impostazioni:uso": return s.uso ?? null;
    case "impostazioni:archiviate": return s.archiviate ?? [];
    case "friday:registro": return s.registro ?? piano(leggiRegistro(path.join(path.sep, "nessuna-home")));
    default: return undefined;
  }
}

export const CANALI = ["sessioni:elenco", "sessioni:messaggi", "sessioni:preferenze", "sessioni:imposta-preferenze", "sessioni:azione",
  "sessioni:impostazioni", "sessioni:imposta-impostazioni", "sessioni:cerca", "sessioni:spazio", "sessioni:ricostruisci", "sessioni:svuota",
  "friday:registro", "friday:comando", "friday:avvia", "impostazioni:radici", "impostazioni:cartelle", "impostazioni:scegli-cartella",
  "impostazioni:apri", "impostazioni:versione", "impostazioni:avvio", "impostazioni:uso", "impostazioni:archiviate"];

export function collegaScena(ipc: IpcMain, s: Scena) {
  for (const c of CANALI) ipc.handle(c, (_e, ...args) => rispostaScena(s, c, args));
}
