// Prova di parità (#351, `npm run parita -- <id>`): lo stato di passaggio di alcuni frame e i dati scritti nei frame.
// La sezione la dà design/scene/<id>.json (navigazione). Fuori dalla prova non serve: l'app legge i dati veri.
export interface Prova {
  /** Generale: la tendina della lingua aperta (101:32827). */
  linguaAperta?: boolean;
  /** Scorciatoie: «Nega» in registrazione con «⌘K» in conflitto, «Ferma la sessione» in ascolto, «Mostra barra laterale» tolta. */
  registrazione?: boolean;
  /** Account: dopo «Rimuovi» di ~/.claude-friday, con l'avviso «Cartella rimossa». */
  dopoRimuovi?: boolean;
  archiviateVuote?: boolean;
  clotch?: boolean;
}

export const PROVE: Record<string, Prova> = {
  "101-32827": { linguaAperta: true },
  "101-33015": { registrazione: true },
  "101-10461": { dopoRimuovi: true },
  "101-48825": { clotch: true },
  "101-48888": { clotch: false },
  "101-32550": { archiviateVuote: true },
  "101-45956": { clotch: true },
  "101-45993": { clotch: false },
};

const id = new URLSearchParams(location.search).get("parita");
/** Vero nella prova di parità: i dati vengono dal disegno, niente letture né scritture. */
export const inParita = !!id;
/** Lo stato del frame in prova, o null nell'app vera. */
export const prova: Prova | null = (id && PROVE[id]) || null;

/** Testi dei frame Account (101:10369). */
export const ACCOUNT_PROVA = [
  { percorso: "~/.claude-accountmanager", dettaglio: "312 sessioni · letta ora", errore: false },
  { percorso: "~/.claude-squadd", dettaglio: "127 sessioni · letta ora", errore: false },
  { percorso: "~/.claude-friday", dettaglio: "Non leggibile: permesso negato", errore: true },
  { percorso: "~/.claude", dettaglio: "48 sessioni · letta ora", errore: false },
  { percorso: "~/.claude-dentalspace", dettaglio: "33 sessioni · letta 2 min fa", errore: false },
];

/** Ultimo evento `impostazioni` di Friday come nel frame 101:17538. */
export const FRIDAY_PROVA: Record<string, unknown> = {
  attiva: true, microfono: "AirPods di Roberto", voce: "Italiana", account: "accountmanager",
  puo_dare_permessi: false, legge_ad_alta_voce: "solo_quando_le_parli",
  microfoni_disponibili: ["AirPods di Roberto"], voci_disponibili: ["Italiana"],
};

/** Quote d'uso dei frame 101:48825 / 48888. */
export const USO_PROVA = [
  { account: "accountmanager", usato: 38, ripartenza: "Riparte tra 6 giorni e 22 ore" },
  { account: "squadd", usato: 72, ripartenza: "Riparte tra 3 giorni e 4 ore" },
  { account: "friday", usato: 100, ripartenza: "Limite raggiunto · riparte alle 18:00" },
  { account: "dentalspace", usato: 12, ripartenza: "Riparte tra 6 giorni e 1 ora" },
];

/** Sessioni archiviate del frame 101:32359. */
export const ARCHIVIATE_PROVA = [
  { titolo: "Notch: avviso schermo", dove: "clotch · 22 ott 2026, 18:40" },
  { titolo: "Voce: parole inglesi", dove: "clotch · 21 ott 2026, 11:02" },
  { titolo: "Backup Hetzner sulle VPS", dove: "squadd-v2 · 19 ott 2026, 09:15" },
];
