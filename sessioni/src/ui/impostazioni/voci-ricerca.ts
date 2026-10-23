// Cerca nelle impostazioni (issue 351): l'elenco delle voci con i testi delle sezioni, e la ricerca.
// shortcut: i testi sono copiati dalle sezioni (non c'è un elenco unico), se una sezione cambia un'etichetta qui va rifatta a mano;
// mancano le voci che nascono dai dati (cartelle degli account, quote d'uso, sessioni archiviate).
import type { Sezione } from "./sezioni";

export interface Voce { sezione: Sezione; etichetta: string; descrizione?: string }

const v = (sezione: Sezione, etichetta: string, descrizione?: string): Voce => ({ sezione, etichetta, descrizione });

/** Nell'ordine delle sezioni nella navigazione e delle righe nella pagina. */
export const VOCI: Voce[] = [
  v("generale", "Apri all’avvio del Mac", "Sessioni parte quando accendi il Mac"),
  v("generale", "Mostra nella barra dei menu", "Un’icona con il numero di sessioni in attesa di te"),
  v("generale", "Lingua", "Testi dell’app"),
  v("generale", "Modello per i tuoi messaggi", "Usato quando scrivi a una sessione da qui"),
  v("generale", "Apri una sessione", "Cosa succede quando ne scegli una dall’elenco"),
  v("generale", "Cartella del registro", "Dove Sessioni scrive gli errori"),
  v("aspetto", "Colore principale", "Bottoni, segni di stato e messaggi tuoi"),
  v("aspetto", "Carattere", "Testo dell’app"),
  v("aspetto", "Dimensione del testo", "Vale per conversazione ed elenco"),
  v("aspetto", "Densità dell’elenco", "Spazio tra le righe della barra laterale"),
  v("aspetto", "Pannello obiettivo", "Mostralo aperto quando apri una sessione"),
  v("aspetto", "Icone delle sessioni", "Mostra l’icona accanto al titolo"),
  v("notifiche", "Sessione in attesa di te", "Quando chiede un permesso o ti fa una domanda"),
  v("notifiche", "Sessione finita", "Quando chiude il turno"),
  v("notifiche", "Errori e blocchi", "Comando non riuscito, regola che blocca, sessione che non risponde"),
  v("notifiche", "Limite di uso", "Quando un account si ferma e quando riparte"),
  v("notifiche", "Suono", "Per le sessioni in attesa di te"),
  v("notifiche", "Silenzio", "Niente notifiche in queste ore"),
  v("friday", "Friday attiva", "Sempre in ascolto, fissa in alto nella barra laterale"),
  v("friday", "Microfono", "Quello che Friday ascolta"),
  v("friday", "Voce", "Come ti risponde"),
  v("friday", "Account", "Quello che usa per lavorare"),
  v("friday", "Può dare i permessi", "Consente i comandi alle sessioni quando glielo chiedi"),
  v("friday", "Legge le risposte ad alta voce", "Solo quando le parli"),
  ...["Cerca sessioni", "Scrivi a Friday", "Prossima sessione in attesa", "Consenti", "Nega", "Ferma la sessione",
    "Mostra barra laterale", "Apri impostazioni", "Invia e interrompi la sessione", "Metti in coda"].map((e) => v("scorciatoie", e)),
  v("sorgenti", "Claude Code", "Sessioni da terminale, da tutte le cartelle degli account"),
  v("sorgenti", "Claude", "Sessioni dell'app Claude per Mac"),
  v("sorgenti", "Codex", "Sessioni di Codex in ~/.codex"),
  v("sorgenti", "Cursor", "Chat di Cursor. Si leggono, ma non ricevono messaggi"),
  v("archiviazione", "Indice delle sessioni", "Ricostruiscilo se l’elenco non torna"),
  v("archiviazione", "Cache dei messaggi", "Si riempie da sola quando apri una sessione"),
  v("dati", "Mostra i comandi interi", "Altrimenti solo il nome del comando"),
  v("dati", "Nascondi chiavi e token", "Li copre con •••• nei messaggi e nei comandi"),
  v("dati", "Cartelle escluse", "Le sessioni in queste cartelle non si leggono"),
  v("dati", "Cronologia", "Per quanto tempo restano le sessioni finite"),
  v("dati", "Dati di Sessioni", "Indice e impostazioni. Le sessioni originali non si toccano."),
  v("info", "Versione", "Aggiornata"),
  v("info", "Aggiornamenti automatici", "Si installano alla prossima apertura"),
  v("info", "Registro", "File con gli errori dell’app"),
  v("info", "Note di rilascio"),
  v("clotch", "Voce dal notch", "Friday parla da Clotch; qui vedi l’indicatore"),
  v("clotch", "Dettatura dal notch", "⌥Spazio apre il microfono di Clotch"),
  v("clotch", "Avvisi nel notch", "Gli avvisi compaiono sotto il notch"),
  v("clotch", "Obiettivi anche nel notch", "Accetta e rifiuta dal notch o da qui"),
];

const parole = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Le voci in cui ogni parola cercata inizia una parola dell'etichetta o della descrizione (senza accenti né maiuscole). */
export function cerca(testo: string): Voce[] {
  const q = parole(testo);
  if (!q.length) return [];
  return VOCI.filter((x) => {
    const p = parole(`${x.etichetta} ${x.descrizione ?? ""}`);
    return q.every((w) => p.some((y) => y.startsWith(w)));
  });
}
