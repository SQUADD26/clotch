// Tasti premuti e scorciatoie salvate: pura conversione, senza React (la provano i test; la usano la pagina Scorciatoie, la casella e il gestore dei tasti).
const SIMBOLI: Record<string, string> = { Enter: "↵", Backspace: "⌫", Delete: "⌦", Tab: "⇥", " ": "Spazio", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** Nomi delle azioni con scorciatoia: l'unica tabella, letta da Impostazioni, dal dialogo ⌘/ e dalla ricerca nelle impostazioni. */
export const AZIONI: [string, string][] = [
  ["cerca", "Cerca sessioni"], ["clotchAi", "Scrivi a clotch AI"], ["prossima", "Prossima sessione in attesa"], ["consenti", "Consenti"],
  ["nega", "Nega"], ["ferma", "Ferma la sessione"], ["barra", "Mostra o nascondi barra laterale"], ["impostazioni", "Apri impostazioni"],
  ["inviaInterrompi", "Interrompi e invia"], ["coda", "Metti in coda"], ["trova", "Cerca nella sessione"],
];
export const nomeAzione = (azione: string) => AZIONI.find(([a]) => a === azione)?.[1] ?? azione;

/** Ordine dei tasti del Mac: ⌃⌥⇧⌘. Le scorciatoie salvate prima in ⌘⇧ si leggono come ⇧⌘. */
export const normalizza = <T extends string | null>(tasti: T): T => (tasti ? (tasti.replace("⌘⇧", "⇧⌘").replace("⌘⌥", "⌥⌘") as T) : tasti);

/** Tasti premuti scritti come sul Mac (⇧⌘F); null se è solo un tasto modificatore. */
export function tastiDi(e: { key: string; code: string; metaKey: boolean; shiftKey: boolean; altKey: boolean; ctrlKey: boolean }): string | null {
  if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return null;
  // con ⌥ o ⇧ `key` cambia carattere: per lettere e cifre vale il tasto fisico
  const tasto = SIMBOLI[e.key] ?? (/^(Key|Digit)/.test(e.code) ? e.code.slice(-1) : e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return (e.ctrlKey ? "⌃" : "") + (e.altKey ? "⌥" : "") + (e.shiftKey ? "⇧" : "") + (e.metaKey ? "⌘" : "") + tasto; // ordine del Mac: ⇧ prima di ⌘ (⇧⌘F), come nelle etichette fisse
}

/** L'azione che questi tasti attivano; null se nessuna li ha, o se più di una (conflitto nel file: meglio nulla che un'azione a caso). */
export function azioneDi(tasti: string | null, salvate: Record<string, string | null>): string | null {
  const azioni = tasti ? Object.keys(salvate).filter((a) => normalizza(salvate[a]) === tasti) : [];
  return azioni.length === 1 ? azioni[0] : null;
}
