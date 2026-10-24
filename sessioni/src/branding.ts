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
  if (icona.isEmpty()) throw new Error("Icona non leggibile");
  app.dock?.setIcon(icona);
  app.setAboutPanelOptions({ applicationName: NOME_APP, applicationVersion: app.getVersion() });
  aggiornaMenu();
}

type Ruolo = NonNullable<Electron.MenuItemConstructorOptions["role"]>;
const voce = (role: Ruolo, label: string, accelerator?: string): Electron.MenuItemConstructorOptions => ({ role, label, ...(accelerator && { accelerator }) });
const sep: Electron.MenuItemConstructorOptions = { type: "separator" };

// «⇧⌘F» dell'app -> «Shift+Command+F» di Electron; un tasto senza nome nel menu: nessuna scorciatoia scritta
const TASTO: Record<string, string> = { "⌃": "Control+", "⌥": "Alt+", "⇧": "Shift+", "⌘": "Command+", "↵": "Return", "⌫": "Backspace", "⇥": "Tab", "←": "Left", "→": "Right", "↑": "Up", "↓": "Down", "+": "Plus" };
const acceleratore = (t: string | null | undefined) => {
  const m = t && /^([⌃⌥⇧⌘]*)(.+)$/u.exec(t);
  return m ? [...m[1]].map((c) => TASTO[c]).join("") + (TASTO[m[2]] ?? (m[2].length === 1 ? m[2] : "")) : undefined;
};
/** Voce che fa un'azione dell'app (#867): la fa il renderer, che ha anche il tasto (registerAccelerator false: il menu la mostra soltanto). */
const azione = (label: string, nome: string, tasti: Record<string, string | null>): Electron.MenuItemConstructorOptions => {
  const accelerator = acceleratore(tasti[nome]);
  return { label, ...(accelerator && !accelerator.endsWith("+") && { accelerator, registerAccelerator: false }), click: (_v, w) => (w as Electron.BrowserWindow | undefined)?.webContents.send("sessioni:menu", nome) };
};

/** Il menu con le scorciatoie dell'app (il main le unisce a quelle di partenza; branding non importa altro, è caricato prima del profilo). */
export const aggiornaMenu = (tasti: Record<string, string | null> = {}) => Menu.setApplicationMenu(Menu.buildFromTemplate(menuApp(tasti)));

/** Menu di un'app macOS, voci e scorciatoie dei frame Figma 148:63680 (clotch), 148:63718 (File), 148:63756 (Modifica), 148:63794 (Vista), 148:63832 (Finestra).
 *  Electron scrive i ruoli in inglese: ogni voce porta etichetta e scorciatoia sue, così il template si verifica (test/menu.test.ts). */
export function menuApp(tasti: Record<string, string | null> = {}): Electron.MenuItemConstructorOptions[] {
  return [
    ...(process.platform === "darwin" ? [{ label: NOME_APP, submenu: [
      voce("about", `Informazioni su ${NOME_APP}`), sep, azione("Impostazioni…", "impostazioni", tasti), sep, voce("services", "Servizi"), sep,
      voce("hide", `Nascondi ${NOME_APP}`, "Command+H"), voce("hideOthers", "Nascondi altre", "Alt+Command+H"), voce("unhide", "Mostra tutto"),
      sep, voce("quit", `Esci da ${NOME_APP}`, "Command+Q"),
    ] }] : []),
    { label: "File", submenu: [voce("close", "Chiudi finestra", "CommandOrControl+W")] },
    { label: "Modifica", submenu: [
      voce("undo", "Annulla", "CommandOrControl+Z"), voce("redo", "Ripeti", "Shift+CommandOrControl+Z"), sep,
      voce("cut", "Taglia", "CommandOrControl+X"), voce("copy", "Copia", "CommandOrControl+C"), voce("paste", "Incolla", "CommandOrControl+V"),
      voce("pasteAndMatchStyle", "Incolla e adatta stile", "Alt+Shift+CommandOrControl+V"), voce("delete", "Elimina"), voce("selectAll", "Seleziona tutto", "CommandOrControl+A"), sep,
      { label: "Voce", submenu: [voce("startSpeaking", "Inizia a parlare"), voce("stopSpeaking", "Interrompi")] },
    ] },
    { label: "Vista", submenu: [
      azione("Mostra/nascondi barra laterale", "barra", tasti), sep, azione("Indietro", "indietro", tasti), azione("Avanti", "avanti", tasti), sep,
      voce("reload", "Ricarica", "CommandOrControl+R"), voce("forceReload", "Forza ricarica", "Shift+CommandOrControl+R"),
      voce("toggleDevTools", "Attiva/disattiva strumenti sviluppatore", "Alt+CommandOrControl+I"), sep,
      voce("resetZoom", "Dimensione reale", "CommandOrControl+0"), voce("zoomIn", "Ingrandisci", "CommandOrControl+Plus"), voce("zoomOut", "Riduci", "CommandOrControl+-"), sep,
      voce("togglefullscreen", "Attiva/disattiva schermo intero", "Control+Command+F"),
    ] },
    { label: "Finestra", role: "windowMenu", submenu: [voce("minimize", "Riduci a icona", "CommandOrControl+M"), voce("zoom", "Zoom"), sep, voce("front", "Porta tutto in primo piano")] },
  ];
}
