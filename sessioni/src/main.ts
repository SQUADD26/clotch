// Processo main: canali IPC verso il renderer (src/ui) e la finestra. `--parita <node-id>` disegna e salva la prova di parità.
import { app, BrowserWindow, ipcMain } from "electron";
import * as os from "node:os";
import * as path from "node:path";
import { impostaIdentita, impostaNome } from "./branding";
import { provaSilenziosa } from "./modalita-prova";
import { verificaChiamante } from "./ipc-fiducia";

// Bootstrap prima degli import con accesso a preferenze, log e dati dell'app.
const iParita = process.argv.indexOf("--parita");
const idParita = iParita > 0 ? process.argv[iParita + 1] : null;
if (iParita > 0) {
  process.env.CLOTCH_TEST_SILENT = "1";
  app.commandLine.appendSwitch("mute-audio");
  if (process.platform === "darwin") app.setActivationPolicy("prohibited");
} else if (provaSilenziosa()) {
  app.commandLine.appendSwitch("mute-audio");
  if (process.platform === "darwin") app.setActivationPolicy("accessory");
}
impostaNome();

import { Sessioni } from "./api";
import { collegaCasella as collegaAllegati } from "./allegati-ipc";
import { collegaAvvisi } from "./avvisi-mac";
import { collegaBarraMenu } from "./barra-menu";
import { apriFinestra, parita } from "./finestra";
import { infoSessione } from "./info-sessione";
import { collegaFriday } from "./friday-ipc";
import { collegaImpostazioni } from "./impostazioni";
import { collegaIndice } from "./indice-ipc";
import { leggiImpostazioni } from "./preferenze";
import { collegaCasella } from "./casella-ipc";
import { collegaPreferenze } from "./preferenze-ipc";
import { CARTELLA_REGISTRO, scriviRegistro, testoErrore } from "./registro";
import { collegaScena, fileScena, leggiScena } from "./scena";
import type { OpzioniCronologia } from "./cronologia-tipi";
import type { PaginaMessaggi } from "./tipi";

// la scala 1 dell'export Figma la dà --force-device-scale-factor=1 sulla riga di comando (npm run parita)
const scena = (() => {
  try { return idParita ? leggiScena(fileScena(path.join(__dirname, "..", ".."), idParita)) : null; }
  catch { return null; } // scena rotta: stesso errore esplicito sotto, mai un dialogo Electron
})();

const sessioni = new Sessioni();

// impostazioni lette dal file a ogni uso (così seguono i cambi); file rotto = valori di partenza
const filePreferenze = path.join(app.getPath("userData"), "preferenze.json");
const impostazioniApp = (): Record<string, unknown> => { try { return leggiImpostazioni(filePreferenze); } catch { return {}; } };
const registra = (m: string) => scriviRegistro(provaSilenziosa() ? path.join(app.getPath("userData"), "logs")
  : String(impostazioniApp().cartellaRegistro || CARTELLA_REGISTRO), m);
process.on("uncaughtException", (e) => registra(`eccezione non gestita: ${testoErrore(e)}`));
process.on("unhandledRejection", (e) => registra(`promessa rifiutata: ${testoErrore(e)}`));
// un solo punto per tutti i canali IPC: ogni errore di un canale va nel registro e poi torna al renderer
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (canale, fn) => handle(canale, async (...a) => {
  try { verificaChiamante(a[0]); return await fn(...a); } catch (e) { registra(`${canale}: ${testoErrore(e)}`); throw e; }
});
const lettiMale = new Set<string>();
const elenco = () => {
  const e = sessioni.elencoSessioni();
  for (const x of e.errori) if (!lettiMale.has(`${x.percorso} ${x.messaggio}`) && lettiMale.add(`${x.percorso} ${x.messaggio}`)) registra(`lettura elenco: ${x.percorso}: ${x.messaggio}`);
  return e;
};

app.whenReady().then(() => {
  if (iParita > 0 && !scena) {
    console.error(`parità: scena non disponibile per ${idParita || "nessun frame"}; servizi dal vivo disattivati`);
    app.exit(1);
    return;
  }
  impostaIdentita();
  if (scena) { collegaScena(ipcMain, scena); return parita(idParita!, scena.navigazione); }
  ipcMain.handle("sessioni:elenco", elenco);
  ipcMain.handle("sessioni:info", (_e, id: string) => infoSessione(sessioni.elencoSessioni().sessioni.find((x) => x.id === String(id))));
  const indice = collegaIndice(ipcMain, sessioni);
  ipcMain.handle("sessioni:messaggi", async (_e, id: string, pagina: number, opzioni?: OpzioniCronologia) => {
    if (opzioni !== undefined && (
      !opzioni || typeof opzioni !== "object" || Array.isArray(opzioni) || opzioni.v !== 1 ||
      (opzioni.cursore !== undefined && (typeof opzioni.cursore !== "string" || opzioni.cursore.length > 4096))
    )) throw new Error("Richiesta cronologia non valida. Riprova.");
    if (opzioni && (!Number.isSafeInteger(pagina) || pagina < 0))
      throw new Error("Pagina cronologia non valida. Riprova.");
    const leggi: (id: string, pagina: number, opzioni?: OpzioniCronologia) => PaginaMessaggi | Promise<PaginaMessaggi>
      = sessioni.messaggi.bind(sessioni);
    const risposta = await leggi(String(id), opzioni ? pagina : Number(pagina) | 0, opzioni);
    if (opzioni) {
      if (!risposta.cronologia && !risposta.erroreCronologia)
        throw new Error("Cronologia non disponibile. Riprova.");
      return risposta;
    }
    return { ...risposta, totale: indice.totale(String(id)) };
  });
  collegaFriday(ipcMain, (c, d) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d)), os.homedir());
  const barraMenu = collegaBarraMenu(sessioni, () => impostazioniApp().barraDeiMenu !== false); // acceso se manca: come PARTENZA
  const invia = (c: string, d: unknown) => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(c, d));
    if (c === "sessioni:impostazioni") barraMenu();
  };
  collegaPreferenze(ipcMain, invia, sessioni);
  collegaCasella(ipcMain, sessioni);
  collegaImpostazioni(ipcMain, sessioni, indice, invia);
  collegaAllegati(ipcMain, os.homedir(), (id) => sessioni.elencoSessioni().sessioni.find((x) => x.id === id)?.file ?? null);
  sessioni.osserva((a) => {
    barraMenu();
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("sessioni:aggiornamento", a));
    const ids = new Set([...a.sessioni, ...a.nuoviMessaggi.map((n) => n.id)]);
    const el = sessioni.elencoSessioni().sessioni;
    const sparite = [...ids].some((id) => !el.some((s) => s.id === id)); // fuori dall'elenco = fuori dall'indice
    if (ids.size) indice.metti(sparite ? el : el.filter((s) => ids.has(s.id)), sparite);
    avvisa(a);
  });
  // dopo osserva(): da qui l'elenco è quello dell'osservatore; il callback gira più tardi, quando `avvisa` esiste già
  const avvisa = collegaAvvisi(() => sessioni.elencoSessioni().sessioni, impostazioniApp);

  barraMenu();
  apriFinestra();
  app.on("activate", () => BrowserWindow.getAllWindows().length || apriFinestra());
});

app.on("window-all-closed", () => {});
