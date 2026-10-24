// Prova di parità (#351, `npm run parita -- <id>`): i dati dei frame stanno nelle scene (design/scene/<id>.json); qui solo
// gli stati di passaggio che un frame mostra a metà di un gesto (tendina aperta, tasti in registrazione, avviso dopo un clic).
export interface Prova {
  /** La tendina aperta: l'etichetta della sua «Scelta» (es. «Lingua» per 101:32827). */
  aperta?: string;
  /** Scorciatoie: «Nega» in registrazione con «⌘K» in conflitto, «Ferma la sessione» in ascolto (101:33015). */
  registrazione?: boolean;
  /** Account: l'avviso «Cartella rimossa» dopo «Rimuovi» (101:10461). */
  dopoRimuovi?: boolean;
  /** Account: il dialogo «Rimuovere la cartella?» già aperto su quel percorso (101:22095). */
  rimuovi?: string;
  /** Dati: il dialogo «Eliminare i dati di Sessioni?» aperto (119:57106). */
  conferma?: boolean;
  /** Info: il dialogo «Novità della versione» già aperto (119:57552). */
  novita?: boolean;
  /** Notifiche: il dialogo «Quando non vuoi ricevere notifiche?» già aperto (149-66688): ore di partenza e segmento col fuoco [riga, segmento]. */
  ore?: { valore: string; attivo: [number, number] };
  /** Uso: la scheda scelta (119:57613). */
  scheda?: "andamento";
  /** Il testo già scritto nel campo «Cerca» (119:57161 «voce», 119:57301 «tema»). */
  cerca?: string;
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
  "149-66688": { ore: { valore: "13:00–15:00", attivo: [0, 0] } },
  "149-66904": { ore: { valore: "22:00–7:00", attivo: [1, 0] } },
  "149-67120": { ore: { valore: "22:00–22:00", attivo: [1, 1] } },
  "101-33015": { registrazione: true },
  "101-10461": { dopoRimuovi: true },
  "101-22095": { rimuovi: "~/.claude-clotch-ai" },
  "119-56891": { aperta: "Cronologia" },
  "119-57106": { conferma: true },
  "119-57404": { aperta: "Versione" },
  "119-57552": { novita: true },
  "119-57613": { scheda: "andamento" },
  "119-57161": { cerca: "voce" },
  "119-57301": { cerca: "tema" },
};

const id = new URLSearchParams(location.search).get("parita");
/** Lo stato di passaggio del frame in prova, o null. */
export const prova: Prova | null = (id && PROVE[id]) || null;
