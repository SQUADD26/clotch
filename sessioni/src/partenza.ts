// Valori di partenza delle impostazioni dell'app: li usano il renderer (ui/impostazioni/stato.ts) e il main (filtro dell'elenco).
import type { ImpostazioniApp } from "./tipi";

/** Valori scritti nei frame Figma delle impostazioni: sono anche quelli di partenza. */
export const PARTENZA: ImpostazioniApp = {
  apriAllAvvio: true, barraDeiMenu: true, lingua: "Italiano", modello: "Opus 5.5", apriSessione: "Nella stessa finestra",
  cartellaRegistro: "~/Library/Logs/Sessioni",
  colore: "Arancione", carattere: "Sistema", dimensione: "Media", densita: "Normale", pannelloAperto: true, iconeSessioni: true,
  avvisoAttesa: true, avvisoFinita: true, avvisoErrori: true, avvisoLimite: true, suono: "Vetro", silenzio: "22:00–8:00",
  sorgenteClaudeCode: true, sorgenteClaude: true, sorgenteCodex: true, sorgenteCursor: false,
  accountTolti: [], accountAggiunti: [],
  comandiInteri: true, nascondiChiavi: true, cartelleEscluse: [], cronologia: "30 giorni",
  aggiornamentiAutomatici: true,
  clotchVoce: true, clotchDettatura: true, clotchAvvisi: true, clotchObiettivi: true,
  scorciatoie: {
    cerca: "⌘K", clotchAi: "⌘⇧F", prossima: "⌘J", consenti: "⌘Y", nega: "⌘⌫", ferma: "⌘.",
    barra: "⌘\\", impostazioni: "⌘,", inviaInterrompi: "↵", coda: "⌘↵",
  },
};
