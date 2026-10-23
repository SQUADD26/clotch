// Processo main: nessuna finestra disegnata qui. L'interfaccia (#331) si aggancia a questi canali IPC.
import { app, BrowserWindow, ipcMain } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Sessioni } from "./api";
import { collegaFriday } from "./friday-ipc";

const sessioni = new Sessioni();

app.whenReady().then(() => {
  ipcMain.handle("sessioni:elenco", () => sessioni.elencoSessioni());
  ipcMain.handle("sessioni:messaggi", (_e, id: string, pagina: number) => sessioni.messaggi(String(id), Number(pagina) | 0));
  collegaFriday(ipcMain, (c, d) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d)), os.homedir());
  sessioni.osserva((a) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("sessioni:aggiornamento", a)));

  const pagina = path.join(__dirname, "..", "..", "renderer", "index.html");
  if (fs.existsSync(pagina)) {
    const w = new BrowserWindow({ webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true } });
    w.loadFile(pagina);
  } // senza renderer l'app resta in attesa: la UI arriva con #331
});

app.on("window-all-closed", () => {});
