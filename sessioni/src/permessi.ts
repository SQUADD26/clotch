// Confine browser: solo scrittura testo negli appunti dal documento principale dell'app.
import type { Session, WebContents } from "electron";
import { pathToFileURL } from "node:url";

const documenti = new WeakMap<WebContents, string>();
const configurate = new WeakSet<Session>();

function documento(url: string): string {
  const u = new URL(url);
  u.search = "";
  u.hash = "";
  return u.href;
}

function copiaConsentita(sessione: Session, contenuto: WebContents | null, permesso: string,
  dettagli: { isMainFrame?: boolean; requestingUrl?: string }): boolean {
  try {
    if (permesso !== "clipboard-sanitized-write" || dettagli.isMainFrame !== true ||
      !dettagli.requestingUrl || !contenuto || contenuto.isDestroyed() || contenuto.session !== sessione) return false;
    const atteso = documenti.get(contenuto);
    return !!atteso && documento(dettagli.requestingUrl) === atteso &&
      documento(contenuto.getURL()) === atteso && documento(contenuto.mainFrame.url) === atteso;
  } catch { return false; }
}

/** Prima di loadFile, per entrambe le factory; una sola policy per sessione condivisa. */
export function impostaPermessi(contenuto: WebContents, pagina: string): void {
  documenti.set(contenuto, pathToFileURL(pagina).href);
  const sessione = contenuto.session;
  if (configurate.has(sessione)) return;
  sessione.setPermissionCheckHandler((wc, permesso, _origine, dettagli) => copiaConsentita(sessione, wc, permesso, dettagli));
  sessione.setPermissionRequestHandler((wc, permesso, rispondi, dettagli) => rispondi(copiaConsentita(sessione, wc, permesso, dettagli)));
  sessione.setDevicePermissionHandler(() => false);
  sessione.setDisplayMediaRequestHandler((_richiesta, rispondi) => rispondi(null), { useSystemPicker: false });
  configurate.add(sessione);
}
