// Icona nella barra dei menu (#409): il numero delle sessioni in attesa di te; il clic mostra la finestra.
// shortcut: icona a colori dell'app, non un PNG «template» in bianco e nero per il Mac. Quando c'è, sostituisce iconaApp().
import { app, BrowserWindow, Tray } from "electron";
import type { Sessioni } from "./api";
import { inAttesa } from "./elenco";
import { iconaApp } from "./branding";
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
    if (!tray) { tray = new Tray(iconaApp().resize({ width: 18, height: 18 })); tray.on("click", mostra); }
    tray.setTitle(String(inAttesa(sessioni.elencoSessioni())));
  };
}
