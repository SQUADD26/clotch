// Registro e casella di Friday, contratto v1 (claude-config global/hooks/friday/CONTRATTO.md, #2479).
// L'app legge solo il registro e scrive solo un file per comando in ~/.claude/casella/comandi/.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { parseRiga, msgErrore } from "./jsonl";
import { aMillisecondi } from "./registri";
import { ErroreLettura } from "./tipi";

export const STATI_FRIDAY = ["lavora", "aspetta", "finito", "serve_roberto", "serve_madre", "bloccato", "ferma_limite"] as const;
export const COMANDI = ["ferma_tutto", "riprendi_tutto", "ferma_chat", "riprendi_chat", "non_disturbare", "annulla", "regola", "parla", "quarantena"] as const;
export type Comando = (typeof COMANDI)[number];

export interface ChatFriday {
  chat: string;
  titolo: string | null;
  madre: string | null;
  stato: string | null;
  dettaglio: string | null;
  aspetto: string | null;
  domanda: string | null;
  /** ms dell'ultima riga di questa chat (battito o altro). */
  visto: number | null;
  fine: string | null;
  fermata: boolean;
  quarantena: string | null;
  errore: string | null;
  rifiuto: string | null;
  /** Righe mancanti nella numerazione `n`: eventi persi. */
  persi: number;
}

export interface Registro {
  chat: Map<string, ChatFriday>;
  fermoTutto: boolean;
  avvisi: { id: string; testo: string; livello: string; motivo: string }[];
  /** Decisioni di Friday ancora annullabili (inverso non nullo e nessun `annulla` fatto). */
  decisioni: { id: string; cosa: string; perche: string; annullabile: boolean }[];
  esiti: Map<string, { esito: string; testo: string }>;
  errori: ErroreLettura[];
}

export const cartellaRegistro = (home: string, env: NodeJS.ProcessEnv = {}) => env.FRIDAY_REGISTRO || path.join(home, ".claude", "registro");

const nuova = (chat: string): ChatFriday => ({
  chat, titolo: null, madre: null, stato: null, dettaglio: null, aspetto: null, domanda: null, visto: null,
  fine: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0,
});
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function leggiRegistro(home: string, env: NodeJS.ProcessEnv = {}): Registro {
  const r: Registro = { chat: new Map(), fermoTutto: false, avvisi: [], decisioni: [], esiti: new Map(), errori: [] };
  const dir = cartellaRegistro(home, env);
  let mesi: string[];
  try {
    mesi = fs.readdirSync(dir).filter((n) => /^\d{4}-\d{2}\.jsonl$/.test(n)).sort();
  } catch (e: any) {
    if (e.code !== "ENOENT") r.errori.push({ percorso: dir, messaggio: msgErrore(e) });
    return r;
  }
  const ultimoN = new Map<string, number>();
  const annullate = new Set<string>();
  const comandi = new Map<string, any>();
  for (const m of mesi) {
    let testo: string;
    try {
      testo = fs.readFileSync(path.join(dir, m), "utf8");
    } catch (e: any) {
      r.errori.push({ percorso: path.join(dir, m), messaggio: msgErrore(e) });
      continue;
    }
    for (const riga of testo.split("\n")) {
      const o = parseRiga(riga);
      if (!o || o.v !== 1 || typeof o.chat !== "string" || typeof o.tipo !== "string") continue; // riga rotta o di un'altra versione
      const d = o.dati ?? {};
      const c = r.chat.get(o.chat) ?? nuova(o.chat);
      r.chat.set(o.chat, c);
      if (Number.isInteger(o.n)) {
        const prima = ultimoN.get(o.chat);
        if (prima !== undefined && o.n > prima + 1) c.persi += o.n - prima - 1;
        ultimoN.set(o.chat, Math.max(prima ?? 0, o.n));
      }
      c.visto = Math.max(c.visto ?? 0, aMillisecondi(o.t) ?? 0) || c.visto;
      switch (o.tipo) {
        case "inizio": c.titolo = s(d.titolo); c.madre = s(d.madre); c.fine = null; break;
        case "battito": if ((STATI_FRIDAY as readonly string[]).includes(d.stato)) c.stato = d.stato; break;
        case "stato":
          if ((STATI_FRIDAY as readonly string[]).includes(d.stato)) {
            Object.assign(c, { stato: d.stato, dettaglio: s(d.dettaglio), aspetto: s(d.aspetto), domanda: s(d.domanda) });
          }
          break;
        case "rifiuto": c.rifiuto = s(d.testo) ?? s(d.regola); break;
        case "errore": c.errore = s(d.testo); break;
        case "fine": c.fine = s(d.motivo) ?? "fine"; break;
        case "fermo":
          if (d.ambito === "tutto") r.fermoTutto = d.acceso === true;
          else if (d.ambito === "chat" && s(d.chi)) {
            const f = r.chat.get(d.chi) ?? nuova(d.chi);
            r.chat.set(d.chi, f);
            f.fermata = d.acceso === true;
          }
          break;
        case "quarantena": {
          const k = s(d.chat) ?? o.chat;
          const q = r.chat.get(k) ?? nuova(k);
          r.chat.set(k, q);
          q.quarantena = d.acceso === true ? s(d.perche) ?? "quarantena" : null;
          break;
        }
        case "avviso": r.avvisi.push({ id: String(o.id), testo: String(d.testo ?? ""), livello: String(d.livello ?? "normale"), motivo: String(d.motivo ?? "") }); break;
        case "decisione": r.decisioni.push({ id: String(o.id), cosa: String(d.cosa ?? ""), perche: String(d.perche ?? ""), annullabile: Array.isArray(d.inverso) }); break;
        case "comando": comandi.set(String(d.id), d); break;
        case "comando_fatto": {
          r.esiti.set(String(d.comando), { esito: String(d.esito ?? ""), testo: String(d.testo ?? "") });
          const cmd = comandi.get(String(d.comando));
          if (d.esito === "ok" && cmd?.cmd === "annulla" && s(cmd.args?.decisione)) annullate.add(cmd.args.decisione);
          break;
        }
      }
    }
  }
  for (const d of r.decisioni) if (annullate.has(d.id)) d.annullabile = false;
  return r;
}

/** Scrive UN comando nella casella: prima `.tmp`, poi rename (Friday non legge mai un file a metà). Torna l'id. */
export function mandaComando(home: string, cmd: Comando, args: Record<string, unknown> = {}, ora = Date.now()): string {
  if (!(COMANDI as readonly string[]).includes(cmd)) throw new Error(`comando sconosciuto: ${cmd}`);
  const dir = path.join(home, ".claude", "casella", "comandi");
  fs.mkdirSync(dir, { recursive: true });
  const id = `c-${crypto.randomBytes(6).toString("hex")}`;
  const corpo = { v: 1, id, t: new Date(ora).toISOString(), da: "app", cmd, args };
  const file = path.join(dir, `${ora}-${id}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(corpo));
  fs.renameSync(`${file}.tmp`, file);
  return id;
}
