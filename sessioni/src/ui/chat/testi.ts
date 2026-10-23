// Testi composti della chat, nelle forme del disegno: «12 s», «4 min 12 s», «da 2 min», «Claude Code · accountmanager».
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
