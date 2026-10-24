// Un solo modo di animare un cambio di struttura (vista, barra, pannello, righe, avvisi): una View Transition di Chromium.
// Il browser fotografa prima e dopo e anima solo le foto (transform e opacità, nel compositore): niente presenza da tenere
// a mano per le uscite. Durate, curve e regole stanno in base/movimento.css, tutte da token (#520).
import { flushSync } from "react-dom";

/** Applica `fai` (setState) dentro una View Transition; senza supporto o a finestra nascosta lo applica e basta. */
export function conTransizione(fai: () => void) {
  if (!document.startViewTransition || document.hidden || document.documentElement.classList.contains("parita")) return fai();
  document.startViewTransition(() => flushSync(fai));
}
