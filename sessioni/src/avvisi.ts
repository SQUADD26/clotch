// Avvisi di sistema del Mac (#407): quando una sessione passa a un altro stato, secondo le impostazioni di Notifiche.
// Funzione pura; l'invio con Electron sta in avvisi-mac.ts. Testi solo dai frame Figma: «Aspetta un permesso» (101:48405),
// «Domanda per te» (101:13896), «Piano da approvare» (101:14132), «Finita» e «Errore» (101:10017), «Bloccato da una regola»
// (101:15790), «Comando non riuscito» (101:12461, strumenti), «Limite di uso raggiunto» (101:16211).
import { PARTENZA } from "./partenza";
import type { Sessione } from "./tipi";

export interface ImpostazioniAvvisi { avvisoAttesa?: boolean; avvisoFinita?: boolean; avvisoErrori?: boolean; avvisoLimite?: boolean; suono?: string; silenzio?: string }
export interface Avviso { titolo: string; corpo: string; silenzioso: boolean; suono?: string }

/** Suoni della tendina (119:56546) -> suoni di sistema del Mac; «Campanello» è «Ping», il rintocco di sistema (#1098). */
export const SUONI: Record<string, string> = { Vetro: "Glass", Campanello: "Ping", Pop: "Pop" };

/** «22:00–8:00» attraversa la mezzanotte; «Mai» o un testo che non è un intervallo = mai in silenzio. */
export function inSilenzio(silenzio: string, ora: Date): boolean {
  const m = /^(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})$/.exec(silenzio);
  if (!m) return false;
  const da = +m[1] * 60 + +m[2], a = +m[3] * 60 + +m[4], t = ora.getHours() * 60 + ora.getMinutes();
  return da <= a ? t >= da && t < a : t >= da || t < a;
}

const adesso = (s: Sessione) => s.situazione?.adesso;
const segno = (s: Sessione, x: string) => (s.situazione?.segni as string[] | undefined)?.includes(x) ?? false;
const ERRORI: [(s: Sessione) => boolean, string][] = [
  [(s) => segno(s, "bloccata_da_hook") || segno(s, "negata_da_regola"), "Bloccato da una regola"],
  [(s) => segno(s, "comando_fallito"), "Comando non riuscito"],
  [(s) => adesso(s) === "errore", "Errore"],
];

/** Cosa avvisare per il passaggio `prima` -> `dopo` (un solo avviso, mai per lo stesso stato); null = niente. `prima` assente = sessione mai vista: niente. */
export function daAvvisare(prima: Sessione | undefined, dopo: Sessione, imp: ImpostazioniAvvisi, ora: Date): Avviso | null {
  if (!prima || inSilenzio(imp.silenzio ?? PARTENZA.silenzio, ora)) return null;
  const nuovo = (f: (s: Sessione) => boolean) => f(dopo) && !f(prima);
  const errore = imp.avvisoErrori !== false ? ERRORI.find(([f]) => nuovo(f))?.[1] : undefined;
  let corpo: string | undefined, attesa = false;
  if (imp.avvisoLimite !== false && nuovo((s) => adesso(s) === "limite")) corpo = "Limite di uso raggiunto";
  else if (errore) corpo = errore;
  else if (imp.avvisoAttesa !== false && nuovo((s) => s.stato === "aspetta")) {
    attesa = true;
    corpo = adesso(dopo) === "domanda" ? "Domanda per te" : adesso(dopo) === "piano" ? "Piano da approvare" : "Permesso richiesto";
  } else if (imp.avvisoFinita !== false && nuovo((s) => s.stato === "finita") && (prima.stato === "lavora" || prima.stato === "aspetta")) corpo = "Finita";
  if (!corpo) return null;
  // il suono è «per le sessioni in attesa di te» (frame 101:17363): gli altri avvisi arrivano muti
  const scelto = imp.suono ?? PARTENZA.suono;
  return { titolo: dopo.titolo, corpo, silenzioso: !attesa || scelto === "Nessun suono", suono: attesa ? SUONI[scelto] : undefined };
}
