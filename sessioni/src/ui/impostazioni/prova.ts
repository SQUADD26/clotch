// Prova di parità (#351, `npm run parita -- <id>`): per ogni frame Figma delle impostazioni, la sezione, lo stato e i dati
// scritti nel frame. Fuori dalla prova non serve: l'app legge i dati veri.
import type { Sezione } from "./sezioni";

export interface Prova {
  sezione: Sezione;
  /** Generale: la tendina della lingua aperta (101:32827). */
  linguaAperta?: boolean;
  /** Scorciatoie: «Nega» in registrazione con «⌘K» in conflitto, «Ferma la sessione» in ascolto, «Mostra barra laterale» tolta. */
  registrazione?: boolean;
  /** Account: dopo «Rimuovi» di ~/.claude-friday, con l'avviso «Cartella rimossa». */
  dopoRimuovi?: boolean;
  archiviateVuote?: boolean;
  cartelleEscluse?: boolean;
  clotch?: boolean;
}

export const PROVE: Record<string, Prova> = {
  "101-17193": { sezione: "generale" },
  "101-32827": { sezione: "generale", linguaAperta: true },
  "101-31738": { sezione: "aspetto" },
  "101-17363": { sezione: "notifiche" },
  "101-17538": { sezione: "friday" },
  "101-17716": { sezione: "scorciatoie" },
  "101-33015": { sezione: "scorciatoie", registrazione: true },
  "101-10300": { sezione: "sorgenti" },
  "101-10369": { sezione: "account" },
  "101-10461": { sezione: "account", dopoRimuovi: true },
  "101-48825": { sezione: "uso", clotch: true },
  "101-48888": { sezione: "uso", clotch: false },
  "101-32359": { sezione: "archiviate" },
  "101-32550": { sezione: "archiviate", archiviateVuote: true },
  "101-32155": { sezione: "archiviazione" },
  "101-17893": { sezione: "dati" },
  "101-33235": { sezione: "dati", cartelleEscluse: true },
  "101-18054": { sezione: "info" },
  "101-45956": { sezione: "clotch", clotch: true },
  "101-45993": { sezione: "clotch", clotch: false },
};

const id = new URLSearchParams(location.search).get("parita");
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
