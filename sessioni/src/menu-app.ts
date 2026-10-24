// Menu dell'app nella barra del Mac (#885, HIG «The menu bar»): voci standard e comandi dell'app con la loro scorciatoia.
// Frame Figma 148:63680 (clotch), 148:63718 (File), 148:63756 (Modifica), 148:63794 (Vista), 148:63832 (Finestra); Vai e Aiuto si aggiungono.
// Una voce dell'app non fa l'azione da sé: manda i suoi tasti alla finestra (preload, «menu:tasti»), che li tratta come premuti.
// Così modali, pagina Scorciatoie che registra e campi di testo valgono uguali col mouse e con la tastiera.
import { BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";
import { nomeAzione, normalizza } from "./ui/impostazioni/tasti";
import { NOME_APP } from "./branding";
import { PARTENZA } from "./partenza";
import { apriFinestra } from "./finestra";
import type { ImpostazioniApp } from "./tipi";

const TASTI: Record<string, string> = { "⌃": "Control+", "⌥": "Alt+", "⇧": "Shift+", "⌘": "Command+" };
const NOMI: Record<string, string> = { "↵": "Enter", "⌫": "Backspace", "⌦": "Delete", "⇥": "Tab", Spazio: "Space", "↑": "Up", "↓": "Down", "←": "Left", "→": "Right", "+": "Plus" };

/** «⇧⌘F» -> «Shift+Command+F», l'acceleratore di Electron. */
export const acceleratore = (tasti: string) => {
  const c = [...tasti];
  return c.filter((x) => TASTI[x]).map((x) => TASTI[x]).join("") + ((r) => NOMI[r] ?? r)(c.filter((x) => !TASTI[x]).join(""));
};

const DIMENSIONI = ["Piccola", "Media", "Grande"];
/** La dimensione del testo un passo più su o più giù; `passo` 0 = quella di partenza. */
export const dimensioneDopo = (attuale: string, passo: -1 | 0 | 1) => passo === 0 || !DIMENSIONI.includes(attuale)
  ? PARTENZA.dimensione : DIMENSIONI[Math.max(0, Math.min(DIMENSIONI.length - 1, DIMENSIONI.indexOf(attuale) + passo))];

function premi(tasti: string) {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (w) return w.webContents.send("menu:tasti", tasti);
  const nuova = apriFinestra(); // nessuna finestra (⌘N, ⌘, col Dock): se ne apre una e i tasti arrivano a pagina pronta
  nuova?.webContents.once("did-finish-load", () => nuova.webContents.send("menu:tasti", tasti));
}

type Ruolo = NonNullable<MenuItemConstructorOptions["role"]>;
const voce = (role: Ruolo, label: string, accelerator?: string): MenuItemConstructorOptions => ({ role, label, ...(accelerator && { accelerator }) });
const sep: MenuItemConstructorOptions = { type: "separator" };
const tasto = (label: string, t: string): MenuItemConstructorOptions => ({ label, accelerator: acceleratore(t), click: () => premi(t) });

/** `i`: impostazioni salvate (scorciatoie e dimensione del testo); `imposta` scrive la dimensione. Electron scrive i ruoli in inglese: ogni voce ha la sua etichetta. */
export function menuApp(i: Partial<ImpostazioniApp> = {}, imposta: (parte: Partial<ImpostazioniApp>) => void = () => {}): MenuItemConstructorOptions[] {
  const salvate: Record<string, string | null> = { ...PARTENZA.scorciatoie, ...i.scorciatoie };
  // shortcut: un'azione a cui l'utente ha tolto la scorciatoia esce dal menu (la voce non avrebbe tasti da mandare); se serve, un canale per azione
  const azione = (a: string, label = nomeAzione(a)) => { const t = normalizza(salvate[a] ?? null); return t ? [tasto(label, t)] : []; };
  const dimensione = i.dimensione ?? PARTENZA.dimensione;
  const testo = (label: string, accelerator: string, passo: -1 | 0 | 1, extra: MenuItemConstructorOptions = {}): MenuItemConstructorOptions =>
    ({ label, accelerator, enabled: dimensioneDopo(dimensione, passo) !== dimensione, click: () => imposta({ dimensione: dimensioneDopo(dimensione, passo) }), ...extra });
  return [
    ...(process.platform === "darwin" ? [{ label: NOME_APP, submenu: [
      voce("about", `Informazioni su ${NOME_APP}`), sep, ...azione("impostazioni", "Impostazioni…"), sep, voce("services", "Servizi"), sep,
      voce("hide", `Nascondi ${NOME_APP}`, "Command+H"), voce("hideOthers", "Nascondi altre", "Alt+Command+H"), voce("unhide", "Mostra tutto"),
      sep, voce("quit", `Esci da ${NOME_APP}`, "Command+Q"),
    ] }] : []),
    { label: "File", submenu: [tasto("Nuova sessione", "⌘N"), sep, voce("close", "Chiudi finestra", "CommandOrControl+W")] },
    { label: "Modifica", submenu: [
      voce("undo", "Annulla", "CommandOrControl+Z"), voce("redo", "Ripeti", "Shift+CommandOrControl+Z"), sep,
      voce("cut", "Taglia", "CommandOrControl+X"), voce("copy", "Copia", "CommandOrControl+C"), voce("paste", "Incolla", "CommandOrControl+V"),
      voce("pasteAndMatchStyle", "Incolla e adatta stile", "Alt+Shift+CommandOrControl+V"), voce("delete", "Elimina"), voce("selectAll", "Seleziona tutto", "CommandOrControl+A"), sep,
      ...azione("cerca"), ...azione("trova"), sep,
      { label: "Voce", submenu: [voce("startSpeaking", "Inizia a parlare"), voce("stopSpeaking", "Interrompi")] },
    ] },
    { label: "Vista", submenu: [
      ...azione("barra"), sep,
      // ⌘+/⌘- cambiano «Dimensione del testo» delle impostazioni: una sola misura del testo, che resta al riavvio. ⌘= è ⌘+ senza ⇧
      testo("Ingrandisci testo", "Command+Plus", 1), testo("Ingrandisci testo", "Command+=", 1, { visible: false, acceleratorWorksWhenHidden: true }),
      testo("Riduci testo", "Command+-", -1), testo("Dimensione reale", "Command+0", 0), sep,
      voce("togglefullscreen", "Attiva/disattiva schermo intero", "Control+Command+F"),
    ] },
    { label: "Vai", submenu: [...azione("indietro"), ...azione("avanti"), sep, ...azione("prossima"), ...azione("clotchAi")] },
    { label: "Finestra", role: "windowMenu", submenu: [voce("minimize", "Riduci a icona", "CommandOrControl+M"), voce("zoom", "Zoom"), sep, voce("front", "Porta tutto in primo piano")] },
    { label: "Aiuto", role: "help", submenu: [tasto("Scorciatoie da tastiera", "⌘/")] },
  ];
}

/** Il menu si rifà a ogni cambio delle impostazioni: `impostazioni()` le rilegge. */
export const collegaMenuApp = (impostazioni: () => Partial<ImpostazioniApp>, imposta: (parte: Partial<ImpostazioniApp>) => void) =>
  () => Menu.setApplicationMenu(Menu.buildFromTemplate(menuApp(impostazioni(), imposta)));
