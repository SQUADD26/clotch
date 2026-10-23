// Testi composti della chat, nelle forme del disegno: «12 s», «4 min 12 s», «da 2 min», «Claude Code · accountmanager».
import type { EsitoComando } from "../../comandi";
import { PARTENZA } from "../../partenza";
import type { Sessione } from "../../tipi";

/** Durata in ms -> «1 s», «41 s», «4 min 12 s», «2 h 5 min». */
export function durata(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

/** Da quanto aspetta: «da 2 min» (minuti interi, almeno 1). */
export const daQuanto = (da: number, ora: number) => `da ${durata(Math.max(60_000, Math.floor((ora - da) / 60_000) * 60_000))}`;

/** «1 messaggio in coda», «3 aiutanti»: singolare per 1. */
export const quanti = (n: number, uno: string, tanti: string) => `${n.toLocaleString("it-IT")} ${n === 1 ? uno : tanti}`;

export const SORGENTE: Record<Sessione["sorgente"], string> = {
  "claude-code": "Claude Code", "claude-desktop": "Claude", codex: "Codex", cursor: "Cursor",
};

/** Nome dell'account dalla cartella radice: «.claude-accountmanager» -> «accountmanager». */
export const nomeAccount = (account: string) => account.replace(/^\./, "").replace(/^claude-/, "");

export const ora = (ms: number) => new Date(ms).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

/** Stato di una scena di prova: `sezione` = «chiave:valore|chiave»; null se la chiave non c'è, "" se non ha valore. */
export const provaDi = (prova: string | null | undefined, chiave: string) => {
  const x = prova?.split("|").find((p) => p === chiave || p.startsWith(`${chiave}:`));
  return x == null ? null : x.slice(chiave.length + 1);
};

/** Etichette del selettore «Modello per i tuoi messaggi» -> id CLI del motore (mai l'etichetta nel comando). */
export const ID_MODELLO: Record<string, string> = {
  "Opus 5.5": "claude-opus-5-5", "Sonnet 5.5": "claude-sonnet-5-5", "Haiku 5.5": "claude-haiku-5-5", "Fable 5.1": "claude-fable-5-1",
};

/** Argomenti di `manda`. `modello` solo se l'utente ha scelto un modello diverso dalla partenza (shortcut: scegliere proprio quello di partenza non lo manda) e solo `subito`: in coda il motore lo rifiuta. */
export const argsManda = (chat: string, testo: string, modo: "subito" | "coda", preferenza: string) =>
  ({ chat, testo, modo, ...(modo === "subito" && preferenza !== PARTENZA.modello && ID_MODELLO[preferenza] ? { modello: ID_MODELLO[preferenza] } : {}) });

/** Testo dell'errore di un comando non riuscito: se il motore l'ha rifiutato, il suo testo. */
export const erroreComando = (e: EsitoComando | null) => (e?.esito === "rifiutato" && e.testo) || "Sessione non raggiunta";
