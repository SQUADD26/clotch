// figma: 101-46268 — la voce di clotch AI. «Voce che parla» (Clotch 101-46268, senza 101-46308) e «Dettatura» (101-46701, 101-46741).
// Chi parla o ascolta: Clotch se è acceso (lo dice il registro, `clotch.parla` e `clotch.ascolta`), altrimenti l'app (`voceApp`
// dal main per le frasi lette con `say`, `dettatura` qui per il microfono del Mac).
import type { ClotchAiApi } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { useClotchAcceso } from "../pannello/Pillole";
import { comanda } from "../chat/clotch-ai";
import { clotchAi, negozio, useRegistro } from "./dati";

export type Voce = { chi: "clotch" | "app"; cosa: "parla" | "ascolta" } | null;

/** Dettatura dell'app (Clotch spento): `attiva` = microfono aperto; `testo` = quello che ha capito finora. */
export const dettatura = negozio({ attiva: false, testo: "" });

export function useVoce(): Voce {
  const { dati: r } = useRegistro();
  const clotch = useClotchAcceso();
  const d = dettatura.usa();
  const chi = clotch ? "clotch" : "app";
  if (d.attiva || (clotch && r?.clotch?.ascolta)) return { chi, cosa: "ascolta" };
  if (clotch ? r?.clotch?.parla : r?.voceApp) return { chi, cosa: "parla" };
  return null;
}

const errore = (messaggio: string) => avvisa({ tipo: "errore", messaggio });
const segnala = (cmd: Parameters<ClotchAiApi["comando"]>[0]) =>
  clotchAi().comando(cmd).then((e) => { if (e.esito !== "ok") errore(e.testo || "clotch AI non raggiunto"); }, () => errore("clotch AI non raggiunto"));

type Riconoscitore = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null };
let riconoscitore: Riconoscitore | null = null;

/** Microfono del bottone «Detta» e di ⌥Spazio. Con Clotch acceso lo apre e lo chiude Clotch (stessa pressione di ⌥Spazio). */
export function dettaChiTocca(clotch: boolean) {
  if (clotch) return void segnala("clotch_dettatura");
  if (riconoscitore) return fineDettatura();
  const Costruttore = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!Costruttore) return errore("Dettatura non disponibile");
  const r: Riconoscitore = new Costruttore();
  r.lang = "it-IT"; r.continuous = true; r.interimResults = true;
  r.onresult = (e) => dettatura.metti({ attiva: true, testo: Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>, (x) => x[0].transcript).join(" ").trim() });
  // «not-allowed»: la finestra non ha il permesso del microfono (permessi.ts lo nega); «network»: Electron non ha il servizio di Google
  r.onerror = (e) => { errore(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microfono non consentito" : "Dettatura interrotta"); chiudi(); };
  r.onend = () => { if (riconoscitore === r) fineDettatura(); };
  riconoscitore = r;
  dettatura.metti({ attiva: true, testo: "" });
  try { r.start(); } catch { errore("Dettatura non disponibile"); chiudi(); }
}

function chiudi() { riconoscitore?.abort(); riconoscitore = null; dettatura.metti({ attiva: false, testo: "" }); }

/** «Fine»: il testo capito va a clotch AI come `parla` (da: app). */
export async function fineDettatura() {
  const testo = dettatura.get().testo.trim();
  riconoscitore?.stop();
  chiudi();
  if (testo) await comanda("parla", { testo });
}

/** «Fine» con Clotch: stessa pressione di ⌥Spazio, il testo lo manda Clotch. */
export const fineDettaturaClotch = () => segnala("clotch_dettatura");
/** «Interrompi»: l'app ferma il suo `say`; per Clotch il segnale non ha ancora un ascoltatore (comandi-app.ts). */
export const interrompiVoce = (chi: "clotch" | "app") => segnala(chi === "clotch" ? "clotch_interrompi_voce" : "voce_ferma");
