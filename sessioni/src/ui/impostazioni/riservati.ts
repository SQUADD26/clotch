// Tasti che l'utente non può assegnare: quelli fissi dell'app (il gestore unico di base/scorciatoie li manda all'azione registrata)
// e quelli del menu nativo (src/branding.ts). Scritti come li dà `tastiDi`. Un solo elenco: lo usa anche la pagina Scorciatoie (#686).
export const FISSE: Record<string, [azione: string, nome: string]> = {
  "⌘N": ["nuova", "Nuova sessione"], "⇧⌘A": ["archivia", "Archivia"], "⇧⌘;": ["copiaBlocco", "Copia ultimo blocco di codice"],
  "⌘U": ["allega", "Allega file"], "⇧⌘P": ["piano", "Modalità piano"],
};
const ALTRI: Record<string, string> = {
  "⌘/": "Mostra scorciatoie", "⌃↑": "Sessione precedente", "⌃↓": "Sessione successiva",
  "⌘W": "Chiudi finestra", "⌘Q": "Esci", "⌘H": "Nascondi", "⌥⌘H": "Nascondi altre", "⌘M": "Riduci a icona", "⌘R": "Ricarica", "⇧⌘R": "Forza ricarica",
  "⌥⌘I": "Strumenti sviluppatore", "⌘0": "Dimensione reale", "⌘+": "Ingrandisci", "⇧⌘+": "Ingrandisci", "⌘=": "Ingrandisci", "⌘-": "Riduci", "⌃⌘F": "Schermo intero",
  "⌘Z": "Annulla", "⇧⌘Z": "Ripeti", "⌘X": "Taglia", "⌘C": "Copia", "⌘V": "Incolla", "⌥⇧⌘V": "Incolla e adatta stile", "⌘A": "Seleziona tutto",
};
/** Il nome di ciò che usa già questi tasti, tra i fissi e il menu; undefined se sono liberi. */
export const riservatoDa = (tasti: string): string | undefined => FISSE[tasti]?.[1] ?? ALTRI[tasti];
