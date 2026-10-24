// Esc chiude un menu, un popover, una tendina o un dialogo: il fuoco torna al pulsante che l'ha aperto (criterio FUOCO-RITORNO).
// Un solo punto per tutta l'app: ricorda l'ultimo elemento col fuoco fuori dai sovrapposti; se Esc lascia il fuoco sul body, ce lo rimette.
// Il clic fuori non passa di qui: lì il fuoco va dove ha cliccato l'utente.
const SOVRAPPOSTO = '[role="menu"], [role="dialog"], .menu, .menu-casella, .popover-attivita';
let ultimo: HTMLElement | null = null;

addEventListener("focusin", (e) => {
  const el = e.target as HTMLElement;
  if (!el.closest?.(SOVRAPPOSTO)) ultimo = el;
}, true);

addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const dentro = !!document.activeElement?.closest?.(SOVRAPPOSTO);
  const apriva = ultimo ?? document.querySelector<HTMLElement>('[aria-expanded="true"]');
  if (!dentro || !apriva) return;
  setTimeout(() => {
    const a = document.activeElement;
    if ((!a || a === document.body) && apriva.isConnected) apriva.focus();
  }, 50);
}, true);
