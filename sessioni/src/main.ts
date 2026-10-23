// Processo main: canali IPC verso il renderer (src/ui) e la finestra. `--parita <node-id>` disegna e salva la prova di parità.
import { app, BrowserWindow, ipcMain } from "electron";
import * as os from "node:os";
import * as path from "node:path";
import { Sessioni } from "./api";
import { apriFinestra, parita } from "./finestra";
import { collegaFriday } from "./friday-ipc";
import { collegaImpostazioni } from "./impostazioni";
import { collegaIndice } from "./indice-ipc";
import { collegaPreferenze } from "./preferenze-ipc";
import { collegaScena, fileScena, leggiScena } from "./scena";

// la scala 1 dell'export Figma la dà --force-device-scale-factor=1 sulla riga di comando (npm run parita)
const iParita = process.argv.indexOf("--parita");
const idParita = iParita > 0 ? process.argv[iParita + 1] : null;
const scena = idParita ? leggiScena(fileScena(path.join(__dirname, "..", ".."), idParita)) : null;

const sessioni = new Sessioni();

app.whenReady().then(() => {
  if (scena) { collegaScena(ipcMain, scena); return parita(idParita!, scena.navigazione); }
  ipcMain.handle("sessioni:elenco", () => sessioni.elencoSessioni());
  const indice = collegaIndice(ipcMain, sessioni);
  ipcMain.handle("sessioni:messaggi", (_e, id: string, pagina: number) => ({ ...sessioni.messaggi(String(id), Number(pagina) | 0), totale: indice.totale(String(id)) }));
  collegaFriday(ipcMain, (c, d) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d)), os.homedir());
  const invia = (c: string, d: unknown) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d));
  collegaPreferenze(ipcMain, invia, sessioni);
  collegaImpostazioni(ipcMain, sessioni, indice, invia);
  sessioni.osserva((a) => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("sessioni:aggiornamento", a));
    const ids = new Set([...a.sessioni, ...a.nuoviMessaggi.map((n) => n.id)]);
    if (ids.size) indice.metti(sessioni.elencoSessioni().sessioni.filter((s) => ids.has(s.id)));
  });

  if (idParita) return parita(idParita);
  apriFinestra();
  app.on("activate", () => BrowserWindow.getAllWindows().length || apriFinestra());
});

app.on("window-all-closed", () => {});
