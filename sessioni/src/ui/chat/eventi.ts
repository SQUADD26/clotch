// Righe del filo che non sono messaggi (101-28652): il cambio di giorno («Ieri», «Oggi») e gli eventi della sessione («Ramo creato: …»). Puro.
import { giorno } from "../barra/elenco";
import type { Voce } from "./modello";

const RAMO = [
  /\bgit\s+(?:-C\s+\S+\s+)?(?:checkout\s+-[bB]|switch\s+-[cC])\s+([^\s;&|]+)/,
  /\bgit\s+(?:-C\s+\S+\s+)?worktree\s+add\b[^;&|]*?\s-[bB]\s+([^\s;&|]+)/,
];

/** Il ramo che un comando di shell crea (`git checkout -b`, `git switch -c`, `git worktree add -b`); null se non ne crea. */
export const ramoCreato = (comando: string) => RAMO.map((r) => comando.match(r)?.[1]).find(Boolean) ?? null;

const tempo = (v: Voce) => v.tipo === "roberto" || v.tipo === "evento" ? v.t : v.tipo === "turno" ? v.inizio : null;

const stessoGiorno = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** Per ogni voce, il giorno da scrivere prima di lei: dove il giorno cambia, e in cima se non è oggi. Gli altri posti sono null. */
export function giorniDelFilo(voci: readonly Voce[], ora: number): (string | null)[] {
  let prima: number | null = null;
  return voci.map((v) => {
    const t = tempo(v);
    if (t == null) return null;
    const cambia = prima == null ? !stessoGiorno(t, ora) : !stessoGiorno(prima, t);
    prima = t;
    return cambia ? giorno(t, ora) : null;
  });
}
