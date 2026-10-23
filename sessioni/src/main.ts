// Processo main: canali IPC verso il renderer (src/ui) e la finestra. `--parita <node-id>` disegna e salva la prova di parità.
import { app, BrowserWindow, ipcMain } from "electron";
import * as os from "node:os";
import * as path from "node:path";
import { Sessioni } from "./api";
import { collegaBarraMenu } from "./barra-menu";
import { apriFinestra, parita } from "./finestra";
import { collegaFriday } from "./friday-ipc";
import { collegaImpostazioni } from "./impostazioni";
import { collegaIndice } from "./indice-ipc";
import { leggiImpostazioni } from "./preferenze";
import { collegaPreferenze } from "./preferenze-ipc";
import { CARTELLA_REGISTRO, scriviRegistro, testoErrore } from "./registro";
import { collegaScena, fileScena, leggiScena } from "./scena";

// la scala 1 dell'export Figma la dà --force-device-scale-factor=1 sulla riga di comando (npm run parita)
const iParita = process.argv.indexOf("--parita");
const idParita = iParita > 0 ? process.argv[iParita + 1] : null;
const scena = idParita ? leggiScena(fileScena(path.join(__dirname, "..", ".."), idParita)) : null;

const sessioni = new Sessioni();

// impostazioni lette dal file a ogni uso (così seguono i cambi); file rotto = valori di partenza
const filePreferenze = path.join(app.getPath("userData"), "preferenze.json");
const impostazioniApp = (): Record<string, unknown> => { try { return leggiImpostazioni(filePreferenze); } catch { return {}; } };
const registra = (m: string) => scriviRegistro(String(impostazioniApp().cartellaRegistro || CARTELLA_REGISTRO), m);
process.on("uncaughtException", (e) => registra(`eccezione non gestita: ${testoErrore(e)}`));
process.on("unhandledRejection", (e) => registra(`promessa rifiutata: ${testoErrore(e)}`));
// un solo punto per tutti i canali IPC: ogni errore di un canale va nel registro e poi torna al renderer
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (canale, fn) => handle(canale, async (...a) => {
  try { return await fn(...a); } catch (e) { registra(`${canale}: ${testoErrore(e)}`); throw e; }
});
const lettiMale = new Set<string>();
const elenco = () => {
  const e = sessioni.elencoSessioni();
  for (const x of e.errori) if (!lettiMale.has(`${x.percorso} ${x.messaggio}`) && lettiMale.add(`${x.percorso} ${x.messaggio}`)) registra(`lettura elenco: ${x.percorso}: ${x.messaggio}`);
  return e;
};

app.whenReady().then(() => {
  if (scena) { collegaScena(ipcMain, scena); return parita(idParita!, scena.navigazione); }
  ipcMain.handle("sessioni:elenco", elenco);
  const indice = collegaIndice(ipcMain, sessioni);
  ipcMain.handle("sessioni:messaggi", (_e, id: string, pagina: number) => ({ ...sessioni.messaggi(String(id), Number(pagina) | 0), totale: indice.totale(String(id)) }));
  collegaFriday(ipcMain, (c, d) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d)), os.homedir());
  const barraMenu = collegaBarraMenu(sessioni, () => impostazioniApp().barraDeiMenu !== false); // acceso se manca: come PARTENZA
  const invia = (c: string, d: unknown) => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d));
    if (c === "sessioni:impostazioni") barraMenu();
  };
  collegaPreferenze(ipcMain, invia, sessioni);
  collegaImpostazioni(ipcMain, sessioni, indice, invia);
  sessioni.osserva((a) => {
    barraMenu();
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("sessioni:aggiornamento", a));
    const ids = new Set([...a.sessioni, ...a.nuoviMessaggi.map((n) => n.id)]);
    const el = sessioni.elencoSessioni().sessioni;
    const sparite = [...ids].some((id) => !el.some((s) => s.id === id)); // fuori dall'elenco = fuori dall'indice
    if (ids.size) indice.metti(sparite ? el : el.filter((s) => ids.has(s.id)), sparite);
  });

  if (idParita) return parita(idParita);
  barraMenu();
  apriFinestra();
  app.on("activate", () => BrowserWindow.getAllWindows().length || apriFinestra());
});

app.on("window-all-closed", () => {});
