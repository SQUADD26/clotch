// Confine main condiviso: il renderer locale non diventa mai un browser.
import { BrowserWindow, dialog, shell } from "electron";

/** Nessun protocollo del sistema, credenziale o carattere di controllo. */
export function urlWeb(valore: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(valore)) return null;
  try {
    const url = new URL(valore);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function proteggiLinkEsterni(finestra: BrowserWindow): void {
  const contenuto = finestra.webContents;
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
  contenuto.on("will-attach-webview", (evento) => evento.preventDefault());
}
