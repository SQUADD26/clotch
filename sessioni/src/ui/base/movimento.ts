// Un solo modo di animare un cambio di struttura (vista, barra, pannello, righe, avvisi): una View Transition di Chromium.
// Il browser fotografa prima e dopo e anima solo le foto (transform e opacità, nel compositore): niente presenza da tenere
// a mano per le uscite. Durate, curve e regole stanno in base/movimento.css, tutte da token (#520).
import { flushSync } from "react-dom";

/** Applica `fai` (setState) dentro una View Transition; senza supporto o a finestra nascosta lo applica e basta.
 *  La promessa si risolve quando il DOM nuovo c'è (per dare il fuoco a ciò che è appena comparso). */
export function conTransizione(fai: () => void): Promise<void> {
  if (!document.startViewTransition || document.hidden || document.documentElement.classList.contains("parita")) { fai(); return Promise.resolve(); }
  const t = document.startViewTransition(() => flushSync(fai));
  // una transizione interrotta da un'altra rifiuta ready e finished: già gestito, il DOM nuovo c'è comunque (#750)
  t.ready.catch(() => {}); t.finished.catch(() => {});
  return t.updateCallbackDone;
}
