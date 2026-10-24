// Registro e casella di clotch AI, contratto v1 (claude-config global/hooks/friday/CONTRATTO.md, #2479). // nome del protocollo del motore
// L'app legge solo il registro e scrive solo un file per comando in ~/.claude/casella/comandi/.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { parseRiga, msgErrore } from "./jsonl";
import { aMillisecondi } from "./registri";
import { ErroreLettura } from "./tipi";
import { ricevutaLocale } from "./clotch-ai-ricevuta";
import type { PassoMacchina } from "./macchine-tipi";

export const STATI_CLOTCH_AI = ["lavora", "aspetta", "finito", "serve_roberto", "serve_madre", "bloccato", "ferma_limite"] as const;
export const COMANDI = [
  "ferma_tutto", "riprendi_tutto", "ferma_chat", "riprendi_chat", "non_disturbare", "annulla", "regola", "parla", "quarantena",
  "rispondi_permesso", "rispondi_domanda", "salta_domanda", "piano", "manda", "coda_modifica", "coda_togli", "interrompi",
  "riprendi_altrove", "account_previsto", "archivia", "ripristina", "obiettivo", "spegni", "imposta", "zitto", "sessione_imposta", "nuova_sessione",
  "macchine", "macchina_aggiungi", "macchina_togli",
] as const;
/** Contratto: «Non risponde = stato lavora e nessun battito da 20 minuti», come friday_triage.FERMO_S (la copia della UI è in ui/chat/clotch-ai.ts). Clotch: ultimo evento più vecchio di 10 min = spento. */
export const NON_RISPONDE_MS = 1_200_000;
export const CLOTCH_SPENTO_MS = 600_000;
export type Comando = (typeof COMANDI)[number];
/** `domanda`: una sessione chiede qualcosa a Roberto. `risposta`: clotch AI risponde a una domanda di Roberto (Clotch la dice come risposta_adhd). */
export const MOTIVI_AVVISO = ["blocco", "chiesto", "goal", "domanda", "fermo", "risposta"] as const;

export interface ChatClotchAi {
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
  richieste: { rid: string; genere: string; strumento: string | null; ingresso: unknown; /** ms dell'evento `richiesta`: «da 2 min». */ t?: number | null; domande: { domanda: string; opzioni: string[] }[] }[];
  /** Finestra di contesto in token, dall'ultimo `inizio` o `battito` che ha `contesto_max`; null = il motore non la dà (Cursor). */
  contestoMax: number | null;
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
  chat: Map<string, ChatClotchAi>;
  fermoTutto: boolean;
  avvisi: { id: string; t: number | null; testo: string; livello: string; motivo: string; dettoDa: string | null; sessioni: string[] }[];
  /** `versione`: CFBundleShortVersionString di Clotch, se l'evento la porta (#344). */
  clotch: { voce: string; parla: boolean; ascolta: boolean; versione?: string | null; t: number;
    /** Parziale di quello che Clotch capisce mentre Roberto parla (claude-config#2572): assente se non parla o se più vecchio di 10 s. */
    testo?: string } | null;
  /** Ultimo evento `friday` (avvio, stop, …): dice se il motore è acceso. */ // nome del protocollo del motore
  clotchAi: { evento: string; t: number } | null;
  /** Comandi presi dalla casella, in ordine. */
  comandi: { id: string; t: number | null; cmd: string; da: string; args: Record<string, any> }[];
  /** Decisioni di clotch AI ancora annullabili (inverso non nullo e nessun `annulla` fatto). */
  decisioni: { id: string; t: number | null; cosa: string; perche: string; chat: string | null; genere: string; nonAnnullabile: string | null; effettoAnnullo: string | null; annullabile: boolean; annullata: boolean }[];
  /** Regole imparate vive: ogni `regola` aggiunge, con `togli` toglie (stesso testo e dove). */
  regole: { testo: string; perche: string; dove: string; t: number | null }[];
  /** Ultimo evento `non_disturbare` acceso: `fino` null = finché non si toglie; `tenuti` = avvisi tenuti per dopo. */
  nonDisturbare: { fino: number | null; tenuti: number } | null;
  /** Ultimo evento `impostazioni`, con i campi del contratto (attiva, microfono, voce, account, puo_dare_permessi, legge_ad_alta_voce, microfoni_disponibili, voci_disponibili). */
  impostazioni: Record<string, unknown> | null;
  esiti: Map<string, { esito: string; testo: string }>;
  /** Eventi `macchina_passo` (gli ultimi 200): avanzamento dal vivo di `macchina_aggiungi`. */
  passiMacchina?: PassoMacchina[];
  errori: ErroreLettura[];
  /** Solo nel registro che l'app manda alle viste (clotch-ai-ipc.ts), mai letti dal disco qui: schermo occupato da uno script,
   *  AFK acceso con gli avvisi tenuti, e se l'app sta dicendo un avviso a voce (Clotch spento). */
  schermo?: { da: number } | null;
  afk?: { da: number; avvisi: number } | null;
  voceApp?: boolean;
}

export const cartellaRegistro = (home: string, env: NodeJS.ProcessEnv = {}) => env.FRIDAY_REGISTRO || path.join(home, ".claude", "registro"); // nome del protocollo del motore

const nuova = (chat: string): ChatClotchAi => ({
  chat, titolo: null, madre: null, progetto: null, account: null, sorgente: null, daHandoff: null, stato: null, dettaglio: null, aspetto: null,
  domanda: null, limite: null, richieste: [], contestoMax: null, battito: null, aiutanti: new Map(), compattazioni: 0, interrotta: null, coda: [],
  obiettivo: null, passi: [], visto: null, fine: null, fineT: null, chatNuova: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0,
});
/** friday_hook.py scrive i passi in italiano; l'app li legge con i nomi di TodoWrite. */ // nome del protocollo del motore
const STATO_PASSO = new Map([["fatto", "completed"], ["in_corso", "in_progress"], ["da_fare", "pending"]]);
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const statoVuoto = () => ({
  r: { chat: new Map(), fermoTutto: false, avvisi: [], clotch: null, clotchAi: null, comandi: [], decisioni: [], regole: [], nonDisturbare: null, impostazioni: null, esiti: new Map(), errori: [], passiMacchina: [] } as Registro,
  ultimoN: new Map<string, number>(), annullate: new Set<string>(), versioniObiettivo: new Map<string, number>(), comandi: new Map<string, any>(),
  nonRiprovabili: new Set<string>(), // annulla rifiutata dal motore per sempre: inutile riproporla
  pos: new Map<string, { ino: number; fine: number }>(), // mese -> file e byte già applicati
});

/** Tutto il registro, letto da capo. Per letture ripetute (a ogni cambio) `lettoreRegistro`. */
export const leggiRegistro = (home: string, env: NodeJS.ProcessEnv = {}): Registro => lettoreRegistro(home, env)();

/** Lettore che ricorda dove è arrivato in ogni mese e applica solo le righe nuove (#474): rileggere tutto a ogni battito costava 15 ms più il clone.
 * Un mese accorciato, sostituito o sparito = si riparte da capo. Torna sempre lo stesso oggetto, aggiornato. */
export function lettoreRegistro(home: string, env: NodeJS.ProcessEnv = {}): () => Registro {
  let st = statoVuoto();
  const leggi = (): Registro => {
    const dir = cartellaRegistro(home, env);
    let mesi: string[];
    try {
      mesi = fs.readdirSync(dir).filter((n) => /^\d{4}-\d{2}\.jsonl$/.test(n)).sort();
    } catch (e: any) {
      st = statoVuoto();
      if (e.code !== "ENOENT") st.r.errori.push({ percorso: dir, messaggio: msgErrore(e) });
      return st.r;
    }
    if ([...st.pos.keys()].some((m) => !mesi.includes(m))) { st = statoVuoto(); return leggi(); }
    st.r.errori = [];
    for (const m of mesi) {
      const file = path.join(dir, m);
      let testo: string;
      try {
        const fd = fs.openSync(file, "r");
        try {
          const f = fs.fstatSync(fd), p = st.pos.get(m);
          if (p && (p.ino !== f.ino || f.size < p.fine)) { st = statoVuoto(); return leggi(); }
          const da = p?.fine ?? 0, b = Buffer.alloc(f.size - da);
          const letti = fs.readSync(fd, b, 0, b.length, da);
          // l'ultima riga senza a capo può essere a metà scrittura: si applica solo se è già JSON intero
          const nl = b.lastIndexOf(10, letti - 1) + 1, resto = b.subarray(nl, letti).toString("utf8");
          const intera = resto.trim() !== "" && parseRiga(resto) !== null;
          testo = b.subarray(0, intera ? letti : nl).toString("utf8");
          st.pos.set(m, { ino: f.ino, fine: da + (intera ? letti : nl) });
        } finally { fs.closeSync(fd); }
      } catch (e: any) {
        st.r.errori.push({ percorso: file, messaggio: msgErrore(e) });
        continue;
      }
      applica(st, testo, home, env);
    }
    st.r.passiMacchina = st.r.passiMacchina!.slice(-200); // tetto anche tra una lettura e l'altra
    for (const d of st.r.decisioni) {
      if (st.annullate.has(d.id)) Object.assign(d, { annullabile: false, annullata: true });
      else if (st.nonRiprovabili.has(d.id)) d.annullabile = false;
    }
    return st.r;
  };
  return leggi;
}

function applica(st: ReturnType<typeof statoVuoto>, testo: string, home: string, env: NodeJS.ProcessEnv) {
  const { r, ultimoN, annullate, nonRiprovabili, versioniObiettivo, comandi } = st;
  {
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
      if ((o.tipo === "inizio" || o.tipo === "battito") && Number.isInteger(d.contesto_max) && d.contesto_max > 0) c.contestoMax = d.contesto_max;
      switch (o.tipo) {
        case "inizio":
          Object.assign(c, { titolo: s(d.titolo), madre: s(d.madre), progetto: s(d.progetto), account: s(d.account), sorgente: s(d.sorgente), daHandoff: s(d.da_handoff), fine: null });
          break;
        case "battito":
          if (t !== null) c.battito = Math.max(c.battito ?? 0, t);
          if (d.stato === "lavora") c.interrotta = null; // turno ripartito dopo l'interruzione
          if ((STATI_CLOTCH_AI as readonly string[]).includes(d.stato)) c.stato = d.stato;
          break;
        case "stato":
          if ((STATI_CLOTCH_AI as readonly string[]).includes(d.stato)) {
            Object.assign(c, { stato: d.stato, dettaglio: s(d.dettaglio), aspetto: s(d.aspetto), domanda: s(d.domanda) });
            c.limite = d.stato === "ferma_limite" ? { account: s(d.account), ripartenza: aMillisecondi(d.riparte_alle) } : null;
          }
          break;
        case "rifiuto": c.rifiuto = s(d.testo) ?? s(d.regola); break;
        case "errore": c.errore = s(d.testo); break;
        case "fine": c.fine = s(d.motivo) ?? "fine"; c.fineT = t; c.chatNuova = s(d.chat_nuova); break;
        case "richiesta":
          c.richieste = c.richieste.filter((x) => x.rid !== String(d.rid)).concat({
            rid: String(d.rid), genere: String(d.genere ?? ""), strumento: s(d.strumento), ingresso: d.ingresso, t,
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
          if (!d.agente && Array.isArray(d.passi)) c.passi = d.passi.filter((p: any) => !p?.tolto).map((p: any) => ({ testo: String(p?.testo ?? ""), stato: STATO_PASSO.get(p?.stato) ?? String(p?.stato ?? "") }));
          break;
        case "regola": {
          const dove = String(d.dove ?? "claude-config"); // default del motore (friday_comandi.py) // nome del protocollo del motore
          r.regole = r.regole.filter((x) => !(x.testo === String(d.testo ?? "") && x.dove === dove));
          if (d.togli !== true) r.regole.push({ testo: String(d.testo ?? ""), perche: String(d.perche ?? ""), dove, t });
          break;
        }
        case "obiettivo": {
          // la versione sale a ogni cambio: una riga in ritardo (remota, riemessa) con versione più bassa non riporta indietro lo stato
          const v = Number.isInteger(d.versione) ? d.versione : null;
          if (v !== null && v < (versioniObiettivo.get(o.chat) ?? 0)) break;
          if (v !== null) versioniObiettivo.set(o.chat, v);
          c.obiettivo = { stato: String(d.stato ?? ""), testo: String(d.testo ?? "") };
          break;
        }
        case "clotch": if (t !== null) {
          const testo = d.ascolta === true && typeof d.testo === "string" && d.testo && Date.now() - t <= 10_000 ? d.testo.slice(0, 2000) : undefined;
          r.clotch = { voce: String(d.voce ?? "spenta"), parla: d.parla === true, ascolta: d.ascolta === true, versione: s(d.versione), t, ...(testo ? { testo } : {}) };
        } break;
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
        case "decisione": r.decisioni.push({ id: String(o.id), t, cosa: String(d.cosa ?? ""), perche: String(d.perche ?? ""), chat: s(d.chat), genere: String(d.genere ?? "altro"), nonAnnullabile: s(d.non_annullabile), effettoAnnullo: s(d.effetto_annullo), annullabile: Array.isArray(d.inverso) && ricevutaLocale(o, home, env), annullata: false });
          // annullata dal terminale: nessun comando dell'app, solo la decisione «annullata <id>» che il motore firma con la sua ricevuta
          if (String(d.cosa).startsWith("annullata ") && ricevutaLocale(o, home, env)) annullate.add(String(d.cosa).slice(10));
          break;
        case "comando":
          comandi.set(String(d.id), d);
          r.comandi.push({ id: String(d.id), t, cmd: String(d.cmd ?? ""), da: String(d.da ?? ""), args: d.args ?? {} });
          break;
        case "macchina_passo": if (t !== null && s(d.nome) && s(d.passo)) r.passiMacchina!.push({ nome: s(d.nome)!, passo: s(d.passo)!, ok: typeof d.ok === "boolean" ? d.ok : null, testo: s(d.testo), comando: s(d.comando), url: s(d.url), codice: s(d.codice), t }); break;
        case "non_disturbare": r.nonDisturbare = d.acceso === true ? { fino: aMillisecondi(d.fino), tenuti: Number(d.tenuti) || 0 } : null; break;
        case "impostazioni": r.impostazioni = d; break;
        case "friday": if (t !== null) r.clotchAi = { evento: String(d.evento ?? ""), t }; break; // nome del protocollo del motore
        case "comando_fatto": {
          r.esiti.set(String(d.comando), { esito: String(d.esito ?? ""), testo: String(d.testo ?? "") });
          const cmd = comandi.get(String(d.comando));
          if (cmd?.cmd === "annulla" && s(cmd.args?.decisione)) {
            const testo = String(d.testo ?? "");
            // shortcut: il motore non dà un codice, si legge la frase; un rifiuto nuovo non riconosciuto lascia l'annulla riprovabile (fino a un codice nel contratto)
            if (d.esito === "ok" || (d.esito === "rifiutato" && /gi[aà]'? annullata/i.test(testo))) annullate.add(cmd.args.decisione);
            else if (d.esito === "rifiutato" && /interrott|non annullabile|senza provenienza|fuori dai comandi|non e'? un argv|non è un argv/i.test(testo)) nonRiprovabili.add(cmd.args.decisione);
          }
          break;
        }
      }
    }
  }
}

/** Contratto: la chat dice «lavora» ma nessun battito da 20 minuti. */
export const nonRisponde = (c: ChatClotchAi, ora: number) => c.stato === "lavora" && !c.fine && ora - (c.battito ?? 0) > NON_RISPONDE_MS;
/** Clotch acceso: ultimo evento `clotch` con voce accesa e più giovane di 10 min. */
export const clotchAcceso = (r: Registro, ora: number) => !!r.clotch && r.clotch.voce === "accesa" && ora - r.clotch.t <= CLOTCH_SPENTO_MS;
/** Avviso letto a voce dall'app solo se clotch AI l'ha dato all'app (Clotch spento). */
export const leggeLApp = (a: Registro["avvisi"][number]) => a.dettoDa !== "clotch";

/** Scrive UN comando nella casella: prima `.tmp`, poi rename (clotch AI non legge mai un file a metà). Torna l'id. */
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
