// Solo finestre create dall'app, sul loro documento locale, possono invocare IPC.
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { pathToFileURL } from "node:url";

const documenti = new WeakMap<WebContents, string>();

/** Chiamata dal main prima del caricamento, mai esposta al renderer. */
export function autorizzaIpc(contenuto: WebContents, pagina: string): void {
  documenti.set(contenuto, pathToFileURL(pagina).href);
}

function documento(url: string): string {
  const u = new URL(url);
  u.search = "";
  u.hash = "";
  return u.href;
}

export function verificaChiamante(evento: IpcMainInvokeEvent): void {
  try {
    const contenuto = evento.sender, atteso = documenti.get(contenuto);
    const frame = evento.senderFrame;
    if (atteso && !contenuto.isDestroyed() && frame && frame === contenuto.mainFrame &&
      documento(frame.url) === atteso && documento(contenuto.getURL()) === atteso) return;
  } catch { /* frame navigato, distrutto o URL malformato: nessun accesso */ }
  throw new Error("Chiamante IPC non autorizzato");
}
