// Scene di prova per la parità (#362): `npm run parita -- <id>` con design/scene/<id>.json. Il main risponde ai canali
// coi dati del disegno al posto di quelli del Mac; la finestra parte dalla vista della scena. Un file per frame.
import * as fs from "node:fs";
import * as path from "node:path";
import type { IpcMain } from "electron";
import { leggiRegistro } from "./friday";
import { piano } from "./friday-ipc";
import type { Archiviata, Novita, CartellaAccount, Elenco, InfoSessione, Messaggio, PreferenzeSessione, QuotaUso } from "./tipi";
import type { OpzioniCronologia } from "./cronologia-tipi";
import { creaCronologiaScena } from "./scena-cronologia";

export interface Scena {
  /** Vista di partenza, come `useNavigazione()`: vista, sessione scelta, sezione. */
  navigazione?: { vista: string; sessione?: string; sezione?: string };
  elenco?: Elenco;
  /** «Avvio» (101:30345): l'elenco non arriva mai, la finestra resta sul logo. */
  avvio?: boolean;
  /** Messaggi per id di sessione, in ordine di tempo. */
  messaggi?: Record<string, Messaggio[]>;
  preferenze?: Record<string, PreferenzeSessione>;
  /** Contesto e file toccati per id di sessione (pannello «Info sessione»). */
  info?: Record<string, InfoSessione>;
  impostazioni?: Record<string, unknown>;
  /** Impostazioni (#351): cartelle degli account come le dà il main, quote d'uso, archiviate, spazio, versione. */
  cartelle?: CartellaAccount[];
  uso?: QuotaUso[];
  archiviate?: Archiviata[];
  spazio?: { indice: number; messaggi: number; immagini: number; altro: number };
  versione?: string;
  /** Info (#351): le note della versione e se c'è «Controlla aggiornamenti». */
  novita?: Novita;
  aggiornamenti?: boolean;
  /** Registro di Friday come lo dà `friday:registro`. */
  registro?: unknown;
}

export const fileScena = (radice: string, id: string) => path.join(radice, "design", "scene", `${id}.json`);
export const leggiScena = (file: string): Scena | null => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

/** «Clotch acceso» scade dopo 10 min (#350): nella scena `clotch.t` ≤ 0 vuol dire «tanti ms fa», da adesso. */
function conOra(r: unknown): unknown {
  const c = (r as { clotch?: { t: number } | null }).clotch;
  return c && c.t <= 0 ? { ...(r as object), clotch: { ...c, t: Date.now() + c.t } } : r;
}

const cronologie = new WeakMap<Scena, ReturnType<typeof creaCronologiaScena>>();

/** Risposta di un canale IPC dalla scena; i canali che scrivono non fanno niente. */
export function rispostaScena(s: Scena, canale: string, args: unknown[]): unknown {
  switch (canale) {
    case "sessioni:elenco": return s.avvio ? new Promise(() => {}) : s.elenco ?? { sessioni: [], errori: [] };
    case "sessioni:messaggi": {
      let cronologia = cronologie.get(s);
      if (!cronologia) {
        cronologia = creaCronologiaScena((id) => s.messaggi?.[id] ?? []);
        cronologie.set(s, cronologia);
      }
      return cronologia.pagina(String(args[0]), args[1] as number, args[2] as OpzioniCronologia | undefined);
    }
    case "sessioni:preferenze": return s.preferenze ?? {};
    case "sessioni:info": return s.info?.[String(args[0])]; // senza `info` la scena non mostra file né contesto
    case "sessioni:impostazioni": return s.impostazioni ?? {};
    case "sessioni:cerca": return [];
    case "sessioni:spazio": return s.spazio ?? { indice: 0, messaggi: 0, immagini: 0, altro: 0 };
    case "impostazioni:radici": return (s.cartelle ?? []).map((c) => c.percorso);
    case "impostazioni:cartelle": return (s.cartelle ?? []).filter((c) => (args[0] as string[]).includes(c.percorso));
    case "impostazioni:versione": return s.versione ?? "";
    case "impostazioni:uso": return s.uso ?? null;
    case "impostazioni:archiviate": return s.archiviate ?? [];
    case "impostazioni:novita": return s.novita ?? null;
    case "impostazioni:aggiornamenti": return args[0] === true ? undefined : s.aggiornamenti ?? false;
    // registro vuoto più i campi della scena: una scena scrive solo quello che il frame mostra
    case "friday:registro": return conOra({ ...piano(leggiRegistro(path.join(path.sep, "nessuna-home"))), ...(s.registro as object) });
    default: return undefined;
  }
}

export const CANALI = ["sessioni:elenco", "sessioni:messaggi", "sessioni:preferenze", "sessioni:imposta-preferenze", "sessioni:azione",
  "sessioni:impostazioni", "sessioni:imposta-impostazioni", "sessioni:cerca", "sessioni:spazio", "sessioni:info", "sessioni:ricostruisci", "sessioni:svuota",
  "friday:registro", "friday:comando", "friday:avvia", "impostazioni:radici", "impostazioni:cartelle", "impostazioni:scegli-cartella",
  "impostazioni:apri", "impostazioni:versione", "impostazioni:avvio", "impostazioni:uso", "impostazioni:archiviate",
  "impostazioni:elimina-dati",
  "impostazioni:novita", "impostazioni:aggiornamenti"];

export function collegaScena(ipc: IpcMain, s: Scena) {
  for (const c of CANALI) ipc.handle(c, (_e, ...args) => rispostaScena(s, c, args));
}
