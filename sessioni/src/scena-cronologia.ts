// Solo fixture: identità sintetiche dichiarate, nessun file reale, Node o Electron.
import type { OpzioniCronologia, RigaCronologia } from "./cronologia-tipi";
import type { Messaggio, PaginaMessaggi } from "./tipi";

let istanze = 0;

/** Una istanza per scena/harness. I cursori leggono il vettore congelato, non la fixture corrente. */
export function creaCronologiaScena(leggi: (sessione: string) => readonly Messaggio[], dimensione = 50) {
  if (!Number.isInteger(dimensione) || dimensione <= 0) throw new Error("Dimensione fixture non valida");
  const istanza = ++istanze;
  let numero = 0;
  type Snapshot = { sessione: string; id: string; righe: RigaCronologia[] };
  const cursori = new Map<string, { snapshot: Snapshot; fine: number }>();
  const errore = (pagina: number, testo: string): PaginaMessaggi => ({
    messaggi: [], pagina, haAltre: false, errore: testo, totale: null,
    erroreCronologia: { codice: "cursore_invalido", testo, ripartenza: "nuova_snapshot" },
  });
  function pagina(sessione: string, pagina: number, opzioni?: OpzioniCronologia): PaginaMessaggi {
    if (opzioni === undefined) {
      const tutti = leggi(sessione), p = Number(pagina) | 0;
      const fine = tutti.length - p * dimensione, inizio = Math.max(0, fine - dimensione);
      return { messaggi: structuredClone(tutti.slice(inizio, Math.max(0, fine))), pagina: p,
        haAltre: inizio > 0, errore: null, totale: tutti.length };
    }
    if (!opzioni || opzioni.v !== 1 || !Number.isInteger(pagina) || pagina < 0 ||
        (opzioni.cursore !== undefined && (typeof opzioni.cursore !== "string" || !opzioni.cursore || opzioni.cursore.length > 4096)))
      return errore(pagina, "Opzioni della cronologia fixture non valide");
    let snapshot: Snapshot, fine: number;
    if (opzioni.cursore !== undefined) {
      const c = cursori.get(opzioni.cursore);
      if (!c || c.snapshot.sessione !== sessione) return errore(pagina, "Cursore della fixture non valido");
      snapshot = c.snapshot; fine = c.fine;
    } else {
      if (pagina !== 0) return errore(pagina, "La fixture richiede un cursore per le pagine precedenti");
      const id = `fixture-snapshot:${istanza}:${++numero}`;
      snapshot = { sessione, id, righe: leggi(sessione).map((messaggio, ordine) => ({
        chiave: `fixture:${sessione}:${ordine}`, ordine, revisione: 1, messaggio: structuredClone(messaggio),
      })) };
      fine = snapshot.righe.length;
    }
    const inizio = Math.max(0, fine - dimensione);
    const prima = inizio > 0 ? `${snapshot.id}:prima:${inizio}` : null;
    if (prima) cursori.set(prima, { snapshot, fine: inizio });
    const righe = structuredClone(snapshot.righe.slice(inizio, fine));
    return { messaggi: righe.map((r) => structuredClone(r.messaggio)), pagina, haAltre: !!prima,
      errore: null, totale: snapshot.righe.length, cronologia: {
        v: 1, sessione, epoca: `fixture:${sessione}`, snapshot: snapshot.id, watermark: 1,
        cursorePrima: prima, righe, totaleSnapshot: snapshot.righe.length,
      } };
  }
  return { pagina };
}
