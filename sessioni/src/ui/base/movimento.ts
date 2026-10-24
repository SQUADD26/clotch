// Un solo modo di animare un cambio di struttura (vista, barra, pannello, righe, avvisi): una View Transition di Chromium.
// Il browser fotografa prima e dopo e anima solo le foto (transform e opacità, nel compositore): niente presenza da tenere
// a mano per le uscite. Durate, curve e regole stanno in base/movimento.css, tutte da token (#520).
import { flushSync } from "react-dom";
import { numero } from "./token";

/** Applica `fai` (setState) dentro una View Transition; senza supporto, o se nessuno guarda la finestra (non ha il fuoco:
 *  nascosta, in secondo piano, prove), lo applica subito. La promessa si risolve quando il DOM nuovo c'è (per il fuoco). */
export function conTransizione(fai: () => void): Promise<void> {
  if (!document.startViewTransition || document.hidden || !document.hasFocus() || document.documentElement.classList.contains("parita")) { fai(); return Promise.resolve(); }
  // una finestra che non disegna (nascosta, prove) non dà mai il fotogramma della foto: senza questo lo stato non cambierebbe
  let scappa = 0;
  const t = document.startViewTransition(() => { clearTimeout(scappa); flushSync(fai); });
  scappa = window.setTimeout(() => t.skipTransition(), numero("tempo-uscita"));
  // saltata (un'altra transizione l'ha interrotta o la finestra non disegna): lo stato cambia lo stesso, niente errore
  t.ready.catch(() => {}); t.finished.catch(() => {});
  return t.updateCallbackDone.catch(() => {});
}
