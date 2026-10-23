// Icona nella barra dei menu (#409): il numero delle sessioni in attesa di te; il clic mostra la finestra.
// shortcut: solo titolo testuale; le icone di design/icone.json sono tracciati vettoriali, non c'è un PNG «template» per il Mac. Quando c'è: nativeImage al posto di createEmpty().
import { app, BrowserWindow, nativeImage, Tray } from "electron";
import type { Sessioni } from "./api";
import { inAttesa } from "./elenco";
import { apriFinestra } from "./finestra";

/** `acceso` si rilegge a ogni `aggiorna()`: impostazioni cambiate o aggiornamento dal vivo. */
export function collegaBarraMenu(sessioni: Sessioni, acceso: () => boolean) {
  let tray: Tray | null = null;
  const mostra = () => {
    const w = BrowserWindow.getAllWindows()[0] ?? apriFinestra();
    if (!w) return;
    if (w.isMinimized()) w.restore();
    w.show(); w.focus(); app.focus({ steal: true });
  };
  return function aggiorna() {
    if (!acceso()) { tray?.destroy(); tray = null; return; }
    if (!tray) { tray = new Tray(nativeImage.createEmpty()); tray.on("click", mostra); }
    tray.setTitle(String(inAttesa(sessioni.elencoSessioni())));
  };
}
