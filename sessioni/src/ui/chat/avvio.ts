// figma: 148-51982 — «Nuova sessione»: le scelte prima del primo messaggio e gli argomenti del comando `nuova_sessione` (contratto del motore, sez. 3).
export interface Ambiente { tipo: "locale" | "ssh" | "cloud" | "remote_control"; host?: string }
export const LOCALE: Ambiente = { tipo: "locale" };

export const nomeAmbiente = (a: Ambiente) => a.tipo === "locale" ? "Questo computer" : a.tipo === "cloud" ? "Cloud" : a.tipo === "remote_control" ? "Remote Control" : a.host ?? "SSH";

const PREDEFINITI = ["dev", "main", "master"];

/** I rami del menu: «Predefiniti» e «Altri rami»; con un testo cercato un elenco solo, senza titoli (148:56927). */
export function gruppiRami(rami: string[], cerca: string): { titolo: string | null; rami: string[] }[] {
  const q = cerca.trim().toLowerCase();
  if (q) { const trovati = rami.filter((r) => r.toLowerCase().includes(q)); return trovati.length ? [{ titolo: null, rami: trovati }] : []; }
  const predefiniti = PREDEFINITI.filter((r) => rami.includes(r)), altri = rami.filter((r) => !predefiniti.includes(r));
  return [...(predefiniti.length ? [{ titolo: "Predefiniti", rami: predefiniti }] : []), ...(altri.length ? [{ titolo: "Altri rami", rami: altri }] : [])];
}

/** La riga sotto i selettori: cosa farà il primo messaggio (148:51982, 148:53138). */
export const notaAvvio = (worktree: boolean, ramo: string | null, cartella: string) =>
  worktree ? `Crea un ramo nuovo da ${ramo ?? "HEAD"} in una cartella separata.` : `Lavora su ${ramo ?? "HEAD"} direttamente dentro ${cartella}.`;

export interface Scelte {
  ambiente: Ambiente; cartella: string; prompt: string; modello: string; sforzo: string;
  /** Solo se la cartella è un repo git: ramo e worktree non si scelgono altrove. */
  git: { ramo: string | null; worktree: boolean } | null;
}

/** Il comando `nuova_sessione`: `macchina` serve solo con ssh; `permessi` non è nel contratto, resta fuori. */
export const argsNuovaSessione = (s: Scelte) => ({
  ambiente: s.ambiente.tipo, ...(s.ambiente.tipo === "ssh" && s.ambiente.host ? { macchina: s.ambiente.host } : {}),
  cartella: s.cartella, ...(s.git ? { worktree: s.git.worktree, ...(s.git.ramo ? { branch: s.git.ramo } : {}) } : {}),
  modello: s.modello, sforzo: s.sforzo, prompt: s.prompt,
});
