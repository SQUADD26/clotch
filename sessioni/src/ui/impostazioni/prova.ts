// Prova di parità (#351, `npm run parita -- <id>`): i dati dei frame stanno nelle scene (design/scene/<id>.json); qui solo
// gli stati di passaggio che un frame mostra a metà di un gesto (tendina aperta, tasti in registrazione, avviso dopo un clic).
export interface Prova {
  /** La tendina aperta: l'etichetta della sua «Scelta» (es. «Lingua» per 101:32827). */
  aperta?: string;
  /** Scorciatoie: «Nega» in registrazione con «⌘K» in conflitto, «Ferma la sessione» in ascolto (101:33015). */
  registrazione?: boolean;
  /** Account: l'avviso «Cartella rimossa» dopo «Rimuovi» (101:10461). */
  dopoRimuovi?: boolean;
  /** Dati: il dialogo «Eliminare i dati di Sessioni?» aperto (119:57106). */
  conferma?: boolean;
  /** Info: il dialogo «Novità della versione» già aperto (119:57552). */
  novita?: boolean;
  /** Uso: la scheda scelta (119:57613). */
  scheda?: "andamento";
}

const PROVE: Record<string, Prova> = {
  "101-32827": { aperta: "Lingua" },
  "119-55555": { aperta: "Modello per i tuoi messaggi" },
  "119-55726": { aperta: "Apri una sessione" },
  "119-55904": { aperta: "Colore principale" },
  "119-56054": { aperta: "Carattere" },
  "119-56211": { aperta: "Dimensione del testo" },
  "119-56375": { aperta: "Densità dell’elenco" },
  "119-56546": { aperta: "Suono" },
  "119-56715": { aperta: "Silenzio" },
  "101-33015": { registrazione: true },
  "101-10461": { dopoRimuovi: true },
  "119-56891": { aperta: "Cronologia" },
  "119-57106": { conferma: true },
  "119-57404": { aperta: "Versione" },
  "119-57552": { novita: true },
  "119-57613": { scheda: "andamento" },
};

const id = new URLSearchParams(location.search).get("parita");
/** Lo stato di passaggio del frame in prova, o null. */
export const prova: Prova | null = (id && PROVE[id]) || null;
