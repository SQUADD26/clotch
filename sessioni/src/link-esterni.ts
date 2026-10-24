// Confine main condiviso: il renderer locale non diventa mai un browser.
import { BrowserWindow, dialog, shell } from "electron";
import { pathToFileURL } from "node:url";

/** Nessun protocollo del sistema, credenziale o carattere di controllo. */
export function urlWeb(valore: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(valore)) return null;
  try {
    const url = new URL(valore);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function documento(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.href;
  } catch { return url; }
}

export function proteggiLinkEsterni(finestra: BrowserWindow, pagina: string): void {
  const contenuto = finestra.webContents;
  const appDoc = pathToFileURL(pagina).href;
  const apri = (valore: string) => {
    const url = urlWeb(valore);
    if (!url) return;
    void shell.openExternal(url).catch((errore: unknown) => {
      // Non registrare URL che possono contenere dati riservati della risposta.
      console.error("clotch: apertura collegamento non riuscita", errore instanceof Error ? errore.name : "errore");
      const opzioni = {
        type: "error" as const, title: "clotch", message: "Collegamento non aperto",
        detail: "Riprova ad aprire il collegamento.", buttons: ["Chiudi"],
      };
      if (finestra.isDestroyed()) dialog.showErrorBox(opzioni.message, opzioni.detail);
      else void dialog.showMessageBox(finestra, opzioni);
    });
  };
  contenuto.setWindowOpenHandler(({ url }) => {
    apri(url);
    return { action: "deny" };
  });
  // Comprende will-navigate e blocca anche iframe estranei. Le ancore dello
  // stesso documento non emettono questo evento e restano interne.
  contenuto.on("will-frame-navigate", (evento) => {
    evento.preventDefault();
    if (evento.isMainFrame) apri(evento.url);
  });
  // view-source:, chrome://, devtools:// e about:blank non passano da will-frame-navigate: Chromium porta il frame a
  // about:blank(#blocked) e la cronologia non ha più la pagina. L'app non ha pagine about:, quindi si ricarica l'ultima.
  let ultima = "";
  contenuto.on("did-navigate", (_e, url) => {
    if (!url.startsWith("about:")) ultima = url;
    else if (ultima) void contenuto.loadURL(ultima).catch(() => {});
  });
  contenuto.on("will-attach-webview", (evento) => evento.preventDefault());
  // Gli schemi interni del browser (about:, chrome:, devtools:, view-source:) non emettono
  // will-navigate: se una pagina porta altrove, si torna subito al documento dell'app.
  contenuto.on("did-navigate", (_evento, url) => {
    if (documento(url) !== appDoc && !finestra.isDestroyed()) void contenuto.loadFile(pagina);
  });
}
