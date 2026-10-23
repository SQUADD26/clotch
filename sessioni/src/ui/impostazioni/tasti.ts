// Tasti premuti e scorciatoie salvate: pura conversione, senza React (la provano i test; la usano la pagina Scorciatoie, la casella e il gestore dei tasti).
const SIMBOLI: Record<string, string> = { Enter: "↵", Backspace: "⌫", Delete: "⌦", Tab: "⇥", " ": "Spazio", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** Tasti premuti scritti come nel disegno (⌘⇧F); null se è solo un tasto modificatore. */
export function tastiDi(e: { key: string; code: string; metaKey: boolean; shiftKey: boolean; altKey: boolean; ctrlKey: boolean }): string | null {
  if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return null;
  // con ⌥ o ⇧ `key` cambia carattere: per lettere e cifre vale il tasto fisico
  const tasto = SIMBOLI[e.key] ?? (/^(Key|Digit)/.test(e.code) ? e.code.slice(-1) : e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return (e.ctrlKey ? "⌃" : "") + (e.altKey ? "⌥" : "") + (e.metaKey ? "⌘" : "") + (e.shiftKey ? "⇧" : "") + tasto; // ⌘ prima di ⇧, come nel disegno (⌘⇧F) e nei valori di partenza
}

/** L'azione che questi tasti attivano; null se nessuna li ha, o se più di una (conflitto nel file: meglio nulla che un'azione a caso). */
export function azioneDi(tasti: string | null, salvate: Record<string, string | null>): string | null {
  const azioni = tasti ? Object.keys(salvate).filter((a) => salvate[a] === tasti) : [];
  return azioni.length === 1 ? azioni[0] : null;
}
