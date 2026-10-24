// figma: 101-46268 — la voce di clotch AI. «Voce che parla» (Clotch 101-46268, senza 101-46308) e «Dettatura» (101-46701, 101-46741).
// Chi parla o ascolta: Clotch se è acceso (lo dice il registro, `clotch.parla` e `clotch.ascolta`), altrimenti l'app (`voceApp`
// dal main per le frasi lette con `say`, `dettatura` qui per il microfono del Mac).
import { useEffect } from "react";
import type { ClotchAiApi } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { useClotchAcceso } from "../pannello/Pillole";
import { chiediA } from "../chat/chiedi";
import { comanda } from "../chat/clotch-ai";
import { clotchAi, negozio, useRegistro } from "./dati";
import { useVoceApp } from "./Voce";

export type Voce = { chi: "clotch" | "app"; cosa: "parla" | "ascolta" } | null;

/** Dettatura dell'app (Clotch spento): `attiva` = microfono aperto; `testo` = quello che ha capito finora. */
export const dettatura = negozio({ attiva: false, testo: "" });

export function useVoce(): Voce {
  const { dati: r } = useRegistro();
  const clotch = useClotchAcceso();
  const d = dettatura.usa();
  const parlaApp = useVoceApp(); // una sola fonte per «l'app parla», la stessa della riga di stato
  const chi = clotch ? "clotch" : "app";
  // Con Clotch acceso la casella mostra il parziale che il motore scrive nel registro, nella stessa vista della dettatura dell'app.
  const parziale = clotch ? (r?.clotch?.ascolta ? r.clotch.testo ?? "" : "") : null;
  useEffect(() => { if (parziale !== null) dettatura.metti({ ...dettatura.get(), testo: parziale }); }, [parziale]);
  if (d.attiva || (clotch && r?.clotch?.ascolta)) return { chi, cosa: "ascolta" };
  if (clotch ? r?.clotch?.parla : parlaApp) return { chi, cosa: "parla" };
  return null;
}

const errore = (messaggio: string) => avvisa({ tipo: "errore", messaggio });
const segnala = (cmd: Parameters<ClotchAiApi["comando"]>[0]) =>
  clotchAi().comando(cmd).then((e) => { if (e.esito !== "ok") errore(e.testo || "clotch non raggiunto"); }, () => errore("clotch non raggiunto"));

let ascolto: (() => void) | null = null; // toglie l'ascolto degli eventi del main

/** Microfono del bottone «Detta» e di ⌥Spazio. Con Clotch acceso lo apre e lo chiude Clotch (stessa pressione di ⌥Spazio). */
export function dettaChiTocca(clotch: boolean) {
  if (clotch) return void segnala("clotch_dettatura");
  if (ascolto) return void fineDettatura();
  // Il microfono lo apre il main con l'eseguibile nativo (dettatura-app.ts): la pagina non ha il permesso «media» e il webkitSpeechRecognition di Electron non ha il servizio di Google.
  ascolto = clotchAi().onDettatura((e) => {
    if ("testo" in e) return dettatura.metti({ attiva: true, testo: e.testo });
    if (e.errore) { errore(e.errore); salvaEChiudi(); } else void fineDettatura();
  });
  dettatura.metti({ attiva: true, testo: "" });
  clotchAi().dettatura(true).catch(() => { errore("Dettatura non disponibile"); salvaEChiudi(); });
}

function chiudi() { ascolto?.(); ascolto = null; dettatura.metti({ attiva: false, testo: "" }); }

/** Il testo già detto non si butta: va nella casella di scrittura (la prende `CasellaClotchAi`, che si riapre al posto della voce). */
function salvaEChiudi() {
  const testo = dettatura.get().testo.trim();
  if (testo) chiediA(testo);
  chiudi();
}

/** «Annulla» ed Esc: il microfono si ferma e quello che ha capito si butta. */
export function annullaDettatura() {
  void clotchAi().dettatura(false).catch(() => {});
  chiudi();
}

/** Si lascia la vista col microfono aperto: si ferma e il testo va nella casella. */
export function fermaPerUscita() {
  if (!ascolto) return;
  void clotchAi().dettatura(false).catch(() => {});
  salvaEChiudi();
}

/** «Fine»: il testo capito va a clotch AI come `parla` (da: app). */
export async function fineDettatura() {
  const testo = dettatura.get().testo.trim();
  void clotchAi().dettatura(false).catch(() => {});
  chiudi();
  if (testo) await comanda("parla", { testo });
  else avvisa({ tipo: "info", messaggio: "Nessuna parola sentita" });
}

/** «Fine» con Clotch: stessa pressione di ⌥Spazio, il testo lo manda Clotch. */
export const fineDettaturaClotch = () => segnala("clotch_dettatura");
/** «Interrompi»: l'app ferma il suo `say`; per Clotch `zitto` va al motore (rifiuto «Clotch non è aperta.» nell'avviso). */
export const interrompiVoce = (chi: "clotch" | "app") => segnala(chi === "clotch" ? "zitto" : "voce_ferma");
