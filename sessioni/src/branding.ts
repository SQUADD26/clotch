// Nome visibile e icona condivisi dal Dock, dal menu e da tutte le finestre.
import { app, Menu, nativeImage } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { provaSilenziosa } from "./modalita-prova";

export const NOME_APP = "clotch";
export const iconaApp = () => nativeImage.createFromPath(path.join(__dirname, "..", "..", "assets", "app-icon.png"));
let cartellaProva: string | undefined;

/** Prima degli import applicativi e di ready: Chromium non deve usare il profilo reale. */
function profiloProva() {
  if (cartellaProva) return path.join(cartellaProva, "userData");
  // CLOTCH_PROVA_RADICE: il banco di misura (#474) sceglie la cartella, per metterci prima indice e cache d'avvio
  const scelta = process.env.CLOTCH_PROVA_RADICE;
  cartellaProva = scelta ? (fs.mkdirSync(scelta, { recursive: true }), scelta) : fs.mkdtempSync(path.join(os.tmpdir(), "clotch-prova-"));
  const radice = cartellaProva, dati = path.join(radice, "userData");
  const pulisci = () => {
    try { fs.rmSync(radice, { recursive: true, force: true }); }
    catch { console.error("clotch: pulizia del profilo di prova non riuscita"); }
  };
  app.once("quit", pulisci);
  process.once("exit", pulisci);
  for (const [nome, dir] of [["userData", dati], ["sessionData", path.join(radice, "sessionData")],
    ["logs", path.join(dati, "logs")], ["crashDumps", path.join(radice, "crashDumps")]] as const) {
    fs.mkdirSync(dir, { recursive: true });
    app.setPath(nome, dir);
  }
  return dati;
}

/** Il nome nuovo non sposta preferenze e indice già presenti. Prima di whenReady(). */
export function impostaNome() {
  const dati = provaSilenziosa() ? profiloProva() : path.join(app.getPath("appData"), "clotch-sessioni");
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
