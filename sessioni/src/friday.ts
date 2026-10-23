// Registro e casella di Friday, contratto v1 (claude-config global/hooks/friday/CONTRATTO.md, #2479).
// L'app legge solo il registro e scrive solo un file per comando in ~/.claude/casella/comandi/.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { parseRiga, msgErrore } from "./jsonl";
import { aMillisecondi } from "./registri";
import { ErroreLettura } from "./tipi";

export const STATI_FRIDAY = ["lavora", "aspetta", "finito", "serve_roberto", "serve_madre", "bloccato", "ferma_limite"] as const;
export const COMANDI = [
  "ferma_tutto", "riprendi_tutto", "ferma_chat", "riprendi_chat", "non_disturbare", "annulla", "regola", "parla", "quarantena",
  "rispondi_permesso", "rispondi_domanda", "salta_domanda", "piano", "manda", "coda_modifica", "coda_togli", "interrompi",
  "riprendi_altrove", "archivia", "ripristina", "obiettivo", "spegni", "imposta",
] as const;
/** Contratto: «Non risponde = stato lavora e nessun battito da 180 s». Clotch: ultimo evento più vecchio di 10 min = spento. */
export const NON_RISPONDE_MS = 180_000;
export const CLOTCH_SPENTO_MS = 600_000;
export type Comando = (typeof COMANDI)[number];
/** `domanda`: una sessione chiede qualcosa a Roberto. `risposta`: Friday risponde a una domanda di Roberto (Clotch la dice come risposta_adhd). */
export const MOTIVI_AVVISO = ["blocco", "chiesto", "goal", "domanda", "fermo", "risposta"] as const;

export interface ChatFriday {
  chat: string;
  titolo: string | null;
  madre: string | null;
  progetto: string | null;
  account: string | null;
  sorgente: string | null;
  daHandoff: string | null;
  stato: string | null;
  dettaglio: string | null;
  aspetto: string | null;
  domanda: string | null;
  /** Con `ferma_limite`. */
  limite: { account: string | null; ripartenza: number | null } | null;
  /** Permessi, domande e piani ancora aperti (chi risponde primo vince). */
  richieste: { rid: string; genere: string; strumento: string | null; ingresso: unknown; domande: { domanda: string; opzioni: string[] }[] }[];
  /** Ultimo `battito` (non risponde si misura da qui). */
  battito: number | null;
  aiutanti: Map<string, { tipo: string | null; modello: string | null; testo: string | null; esito: string | null; finito: boolean }>;
  compattazioni: number;
  interrotta: string | null;
  coda: { voce: string; testo: string }[];
  obiettivo: { stato: string; testo: string } | null;
  /** Passi dell'agente principale (agente ""), dall'ultimo evento `passi`. */
  passi: { testo: string; stato: string }[];
  /** ms dell'ultima riga di questa chat (battito o altro). */
  visto: number | null;
  fine: string | null;
  /** ms dell'evento `fine`. */
  fineT: number | null;
  chatNuova: string | null;
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
  avvisi: { id: string; t: number | null; testo: string; livello: string; motivo: string; dettoDa: string | null; sessioni: string[] }[];
  clotch: { voce: string; parla: boolean; ascolta: boolean; t: number } | null;
  /** Ultimo evento `friday` (avvio, stop, …): dice se il motore è acceso. */
  friday: { evento: string; t: number } | null;
  /** Comandi presi dalla casella, in ordine. */
  comandi: { id: string; t: number | null; cmd: string; da: string; args: Record<string, any> }[];
  /** Decisioni di Friday ancora annullabili (inverso non nullo e nessun `annulla` fatto). */
  decisioni: { id: string; t: number | null; cosa: string; perche: string; chat: string | null; genere: string; nonAnnullabile: string | null; effettoAnnullo: string | null; annullabile: boolean; annullata: boolean }[];
  /** Regole imparate vive: ogni `regola` aggiunge, con `togli` toglie (stesso testo e dove). */
  regole: { testo: string; perche: string; dove: string; t: number | null }[];
  /** Ultimo evento `non_disturbare` acceso: `fino` null = finché non si toglie; `tenuti` = avvisi tenuti per dopo. */
  nonDisturbare: { fino: number | null; tenuti: number } | null;
  /** Ultimo evento `impostazioni`, con i campi del contratto (attiva, microfono, voce, account, puo_dare_permessi, legge_ad_alta_voce, microfoni_disponibili, voci_disponibili). */
  impostazioni: Record<string, unknown> | null;
  esiti: Map<string, { esito: string; testo: string }>;
  errori: ErroreLettura[];
}

export const cartellaRegistro = (home: string, env: NodeJS.ProcessEnv = {}) => env.FRIDAY_REGISTRO || path.join(home, ".claude", "registro");

const nuova = (chat: string): ChatFriday => ({
  chat, titolo: null, madre: null, progetto: null, account: null, sorgente: null, daHandoff: null, stato: null, dettaglio: null, aspetto: null,
  domanda: null, limite: null, richieste: [], battito: null, aiutanti: new Map(), compattazioni: 0, interrotta: null, coda: [],
  obiettivo: null, passi: [], visto: null, fine: null, fineT: null, chatNuova: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0,
});
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function leggiRegistro(home: string, env: NodeJS.ProcessEnv = {}): Registro {
  const r: Registro = { chat: new Map(), fermoTutto: false, avvisi: [], clotch: null, friday: null, comandi: [], decisioni: [], regole: [], nonDisturbare: null, impostazioni: null, esiti: new Map(), errori: [] };
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
      const t = aMillisecondi(o.t);
      if (t !== null) c.visto = Math.max(c.visto ?? 0, t);
      switch (o.tipo) {
        case "inizio":
          Object.assign(c, { titolo: s(d.titolo), madre: s(d.madre), progetto: s(d.progetto), account: s(d.account), sorgente: s(d.sorgente), daHandoff: s(d.da_handoff), fine: null });
          break;
        case "battito":
          if (t !== null) c.battito = Math.max(c.battito ?? 0, t);
          if (d.stato === "lavora") c.interrotta = null; // turno ripartito dopo l'interruzione
          if ((STATI_FRIDAY as readonly string[]).includes(d.stato)) c.stato = d.stato;
          break;
        case "stato":
          if ((STATI_FRIDAY as readonly string[]).includes(d.stato)) {
            Object.assign(c, { stato: d.stato, dettaglio: s(d.dettaglio), aspetto: s(d.aspetto), domanda: s(d.domanda) });
            c.limite = d.stato === "ferma_limite" ? { account: s(d.account), ripartenza: aMillisecondi(d.riparte_alle) } : null;
          }
          break;
        case "rifiuto": c.rifiuto = s(d.testo) ?? s(d.regola); break;
        case "errore": c.errore = s(d.testo); break;
        case "fine": c.fine = s(d.motivo) ?? "fine"; c.fineT = t; c.chatNuova = s(d.chat_nuova); break;
        case "richiesta":
          c.richieste = c.richieste.filter((x) => x.rid !== String(d.rid)).concat({
            rid: String(d.rid), genere: String(d.genere ?? ""), strumento: s(d.strumento), ingresso: d.ingresso,
            domande: Array.isArray(d.domande) ? d.domande.map((q: any) => ({ domanda: String(q?.domanda ?? ""), opzioni: Array.isArray(q?.opzioni) ? q.opzioni.map(String) : [] })) : [],
          });
          break;
        case "richiesta_chiusa": c.richieste = c.richieste.filter((x) => x.rid !== String(d.rid)); break;
        case "aiutante":
          c.aiutanti.set(String(d.agente), { tipo: s(d.tipo), modello: s(d.modello), testo: s(d.testo), esito: s(d.esito), finito: d.fase === "fine" });
          break;
        case "compattazione": c.compattazioni++; break;
        case "interrotta": c.interrotta = s(d.da) ?? "roberto"; break;
        case "coda": c.coda = Array.isArray(d.voci) ? d.voci.map((v: any) => ({ voce: String(v?.voce ?? ""), testo: String(v?.testo ?? "") })) : []; break;
        case "passi":
          if (!d.agente && Array.isArray(d.passi)) c.passi = d.passi.filter((p: any) => !p?.tolto).map((p: any) => ({ testo: String(p?.testo ?? ""), stato: String(p?.stato ?? "") }));
          break;
        case "regola": {
          const dove = String(d.dove ?? "claude-config"); // default del motore (friday_comandi.py)
          r.regole = r.regole.filter((x) => !(x.testo === String(d.testo ?? "") && x.dove === dove));
          if (d.togli !== true) r.regole.push({ testo: String(d.testo ?? ""), perche: String(d.perche ?? ""), dove, t });
          break;
        }
        case "obiettivo": c.obiettivo = { stato: String(d.stato ?? ""), testo: String(d.testo ?? "") }; break;
        case "clotch": if (t !== null) r.clotch = { voce: String(d.voce ?? "spenta"), parla: d.parla === true, ascolta: d.ascolta === true, t }; break;
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
        case "avviso": r.avvisi.push({ id: String(o.id), t, testo: String(d.testo ?? ""), livello: String(d.livello ?? "normale"), motivo: String(d.motivo ?? ""), dettoDa: s(d.detto_da),
          // facoltativo (claude-config#2512): id chat delle sessioni citate in una risposta
          sessioni: Array.isArray(d.sessioni) ? d.sessioni.filter((x: unknown): x is string => typeof x === "string") : [] }); break;
        case "decisione": r.decisioni.push({ id: String(o.id), t, cosa: String(d.cosa ?? ""), perche: String(d.perche ?? ""), chat: s(d.chat), genere: String(d.genere ?? "altro"), nonAnnullabile: s(d.non_annullabile), effettoAnnullo: s(d.effetto_annullo), annullabile: Array.isArray(d.inverso), annullata: false }); break;
        case "comando":
          comandi.set(String(d.id), d);
          r.comandi.push({ id: String(d.id), t, cmd: String(d.cmd ?? ""), da: String(d.da ?? ""), args: d.args ?? {} });
          break;
        case "non_disturbare": r.nonDisturbare = d.acceso === true ? { fino: aMillisecondi(d.fino), tenuti: Number(d.tenuti) || 0 } : null; break;
        case "impostazioni": r.impostazioni = d; break;
        case "friday": if (t !== null) r.friday = { evento: String(d.evento ?? ""), t }; break;
        case "comando_fatto": {
          r.esiti.set(String(d.comando), { esito: String(d.esito ?? ""), testo: String(d.testo ?? "") });
          const cmd = comandi.get(String(d.comando));
          if (d.esito === "ok" && cmd?.cmd === "annulla" && s(cmd.args?.decisione)) annullate.add(cmd.args.decisione);
          break;
        }
      }
    }
  }
  for (const d of r.decisioni) if (annullate.has(d.id)) Object.assign(d, { annullabile: false, annullata: true });
  return r;
}

/** Contratto: la chat dice «lavora» ma nessun battito da 180 s. */
export const nonRisponde = (c: ChatFriday, ora: number) => c.stato === "lavora" && !c.fine && ora - (c.battito ?? 0) > NON_RISPONDE_MS;
/** Clotch acceso: ultimo evento `clotch` con voce accesa e più giovane di 10 min. */
export const clotchAcceso = (r: Registro, ora: number) => !!r.clotch && r.clotch.voce === "accesa" && ora - r.clotch.t <= CLOTCH_SPENTO_MS;
/** Avviso letto a voce dall'app solo se Friday l'ha dato all'app (Clotch spento). */
export const leggeLApp = (a: Registro["avvisi"][number]) => a.dettoDa !== "clotch";

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
