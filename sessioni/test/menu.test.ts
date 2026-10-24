import test from "node:test";
import assert from "node:assert/strict";
import { menuApp } from "../src/branding";
import { PARTENZA } from "../src/partenza";

// Il menu nella barra del Mac come lo disegnano i frame Figma 148:63680 (clotch), 148:63718 (File), 148:63756 (Modifica), 148:63794 (Vista), 148:63832 (Finestra):
// «etichetta scorciatoia», «—» il separatore, «›» il sottomenu. Le scorciatoie sono quelle che il Mac mostra (⌃ ⌥ ⇧ ⌘).
const FRAME: Record<string, string[]> = {
  clotch: ["Informazioni su clotch", "—", "Impostazioni… ⌘,", "—", "Servizi", "—", "Nascondi clotch ⌘H", "Nascondi altre ⌥⌘H", "Mostra tutto", "—", "Esci da clotch ⌘Q"],
  File: ["Chiudi finestra ⌘W"],
  Modifica: ["Annulla ⌘Z", "Ripeti ⇧⌘Z", "—", "Taglia ⌘X", "Copia ⌘C", "Incolla ⌘V", "Incolla e adatta stile ⌥⇧⌘V", "Elimina", "Seleziona tutto ⌘A", "—", "Voce ›"],
  Vista: ["Mostra/nascondi barra laterale ⌘\\", "—", "Indietro ⌘[", "Avanti ⌘]", "—", "Ricarica ⌘R", "Forza ricarica ⇧⌘R", "Attiva/disattiva strumenti sviluppatore ⌥⌘I", "—", "Dimensione reale ⌘0", "Ingrandisci ⌘+", "Riduci ⌘-", "—", "Attiva/disattiva schermo intero ⌃⌘F"],
  Finestra: ["Riduci a icona ⌘M", "Zoom", "—", "Porta tutto in primo piano"],
};
const TASTI: Record<string, string> = { Control: "⌃", Alt: "⌥", Shift: "⇧", Command: "⌘", CommandOrControl: "⌘", Plus: "+" };
const glifi = (a: string) => { const p = a.split("+"); const tasto = p.pop()!; return [...p].sort((x, y) => "⌃⌥⇧⌘".indexOf(TASTI[x]) - "⌃⌥⇧⌘".indexOf(TASTI[y])).map((m) => TASTI[m]).join("") + (TASTI[tasto] ?? tasto); };
const riga = (v: Electron.MenuItemConstructorOptions) =>
  v.type === "separator" ? "—" : [v.label, v.submenu ? "›" : v.accelerator ? glifi(v.accelerator) : ""].filter(Boolean).join(" ");

test("menu dell'app: stesse voci, nello stesso ordine, e stesse scorciatoie dei frame", () => {
  const menu = menuApp(PARTENZA.scorciatoie).filter((m) => process.platform === "darwin" || m.label !== "clotch");
  assert.deepEqual(menu.map((m) => m.label), Object.keys(FRAME).filter((k) => process.platform === "darwin" || k !== "clotch"));
  for (const m of menu) assert.deepEqual((m.submenu as Electron.MenuItemConstructorOptions[]).map(riga), FRAME[m.label!], m.label);
});

test("menu dell'app: le voci delle azioni mostrano la scorciatoia salvata e non la registrano (#867)", () => {
  const voci = menuApp({ impostazioni: "⌥⌘P", barra: null, indietro: "⌘⌫", avanti: "⌘]" }).flatMap((m) => m.submenu as Electron.MenuItemConstructorOptions[]);
  const di = (l: string) => voci.find((v) => v.label === l)!;
  if (process.platform === "darwin") assert.equal(riga(di("Impostazioni…")), "Impostazioni… ⌥⌘P"); // il menu «clotch» c'è solo sul Mac
  assert.equal(riga(di("Mostra/nascondi barra laterale")), "Mostra/nascondi barra laterale");
  assert.equal(di("Indietro").accelerator, "Command+Backspace");
  assert.equal(di("Avanti").registerAccelerator, false);
});
