// Prova di parità (#351, `npm run parita -- <id>`): i dati dei frame stanno nelle scene (design/scene/<id>.json); qui solo
// gli stati di passaggio che un frame mostra a metà di un gesto (tendina aperta, tasti in registrazione, avviso dopo un clic).
export interface Prova {
  /** Generale: la tendina della lingua aperta (101:32827). */
  linguaAperta?: boolean;
  /** Scorciatoie: «Nega» in registrazione con «⌘K» in conflitto, «Ferma la sessione» in ascolto (101:33015). */
  registrazione?: boolean;
  /** Account: l'avviso «Cartella rimossa» dopo «Rimuovi» (101:10461). */
  dopoRimuovi?: boolean;
}

const PROVE: Record<string, Prova> = {
  "101-32827": { linguaAperta: true },
  "101-33015": { registrazione: true },
  "101-10461": { dopoRimuovi: true },
};

const id = new URLSearchParams(location.search).get("parita");
/** Lo stato di passaggio del frame in prova, o null. */
export const prova: Prova | null = (id && PROVE[id]) || null;
