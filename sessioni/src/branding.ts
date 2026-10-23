// Nome visibile e icona condivisi dal Dock, dal menu e da tutte le finestre.
import { app, Menu, nativeImage } from "electron";
import * as path from "node:path";

export const NOME_APP = "clotch";
export const iconaApp = () => nativeImage.createFromPath(path.join(__dirname, "..", "..", "assets", "app-icon.png"));

/** Il nome nuovo non sposta preferenze e indice già presenti. Prima di whenReady(). */
export function impostaNome() {
  const dati = path.join(app.getPath("appData"), "clotch-sessioni");
  app.setName(NOME_APP);
  app.setPath("userData", dati);
}

/** macOS richiede il Dock esplicito; BrowserWindow usa la stessa immagine sugli altri sistemi. */
export function impostaIdentita() {
  const icona = iconaApp();
  if (icona.isEmpty()) throw new Error("Icona di clotch non leggibile");
  app.dock?.setIcon(icona);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{ role: "appMenu" as const, label: NOME_APP }] : []),
    { role: "fileMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" },
  ]));
}
