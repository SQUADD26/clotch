// figma: 101-22186 — le scorciatoie del dialogo, in due colonne. `azione` = voce di «Impostazioni · Scorciatoie»: il tasto è quello salvato
// (se l'ho tolto, «Non assegnata»); senza `azione` il tasto è fisso, scritto come nel disegno.
export interface Riga { etichetta: string; azione?: string; fisso?: string }
export interface Gruppo { titolo: string; colonna: 0 | 1; righe: Riga[] }

export const GRUPPI: Gruppo[] = [
  { titolo: "Navigazione", colonna: 0, righe: [
    { etichetta: "Cerca sessioni", azione: "cerca" }, { etichetta: "Prossima sessione in attesa", azione: "prossima" },
    { etichetta: "Sessione precedente", fisso: "⌃↑" }, { etichetta: "Sessione successiva", fisso: "⌃↓" },
    { etichetta: "Mostra o nascondi barra laterale", azione: "barra" }, { etichetta: "Cerca nella sessione", azione: "trova" },
  ] },
  { titolo: "Generale", colonna: 0, righe: [
    { etichetta: "Apri impostazioni", azione: "impostazioni" }, { etichetta: "Mostra scorciatoie", fisso: "⌘/" },
    { etichetta: "Scrivi a clotch AI", azione: "clotchAi" }, { etichetta: "Nuova sessione", fisso: "⌘N" },
  ] },
  { titolo: "Sessione", colonna: 1, righe: [
    { etichetta: "Consenti", azione: "consenti" }, { etichetta: "Nega", azione: "nega" }, { etichetta: "Ferma la sessione", azione: "ferma" },
    { etichetta: "Archivia", fisso: "⇧⌘A" }, { etichetta: "Copia ultimo blocco di codice", fisso: "⇧⌘;" }, { etichetta: "Modalità piano", fisso: "⇧⌘P" },
  ] },
  { titolo: "Casella", colonna: 1, righe: [
    { etichetta: "Interrompi e invia", azione: "inviaInterrompi" }, { etichetta: "Metti in coda", azione: "coda" },
    { etichetta: "A capo", fisso: "⇧↵" }, { etichetta: "Allega file", fisso: "⌘U" }, { etichetta: "Comandi", fisso: "/" }, { etichetta: "File", fisso: "@" },
  ] },
];

/** Gruppi con i tasti veri e solo le righe che contengono `q` (nel nome o nei tasti); i gruppi vuoti spariscono. */
export function filtra(salvate: Record<string, string | null>, q: string): { titolo: string; colonna: 0 | 1; righe: { etichetta: string; tasti: string | null }[] }[] {
  const t = q.trim().toLowerCase();
  return GRUPPI.map((g) => ({
    titolo: g.titolo, colonna: g.colonna,
    righe: g.righe.map((r) => ({ etichetta: r.etichetta, tasti: r.azione ? salvate[r.azione] ?? null : r.fisso ?? null }))
      .filter((r) => !t || r.etichetta.toLowerCase().includes(t) || (r.tasti ?? "").toLowerCase().includes(t)),
  })).filter((g) => g.righe.length);
}
