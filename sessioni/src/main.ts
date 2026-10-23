// Processo main: canali IPC verso il renderer (src/ui) e la finestra. `--parita <node-id>` disegna e salva la prova di parità.
import { app, BrowserWindow, ipcMain } from "electron";
import * as os from "node:os";
import { Sessioni } from "./api";
import { apriFinestra, parita } from "./finestra";
import { collegaFriday } from "./friday-ipc";
import { collegaPreferenze } from "./preferenze-ipc";

// la scala 1 dell'export Figma la dà --force-device-scale-factor=1 sulla riga di comando (npm run parita)
const iParita = process.argv.indexOf("--parita");

const sessioni = new Sessioni();

app.whenReady().then(() => {
  ipcMain.handle("sessioni:elenco", () => sessioni.elencoSessioni());
  ipcMain.handle("sessioni:messaggi", (_e, id: string, pagina: number) => sessioni.messaggi(String(id), Number(pagina) | 0));
  collegaFriday(ipcMain, (c, d) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d)), os.homedir());
  collegaPreferenze(ipcMain, (c, d) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d)), sessioni);
  sessioni.osserva((a) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("sessioni:aggiornamento", a)));

  if (iParita > 0) return parita(process.argv[iParita + 1]);
  apriFinestra();
  app.on("activate", () => BrowserWindow.getAllWindows().length || apriFinestra());
});

app.on("window-all-closed", () => {});
