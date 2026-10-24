import test from "node:test";
import assert from "node:assert/strict";
import { acceleratore, dimensioneDopo, menuApp } from "../src/menu-app";
import { PARTENZA } from "../src/partenza";

// Il menu nella barra del Mac (frame Figma 148:63680, 148:63718, 148:63756, 148:63794, 148:63832; #885: comandi dell'app, niente Ricarica e strumenti sviluppatore):
// «etichetta scorciatoia», «—» il separatore, «›» il sottomenu. Le scorciatoie sono quelle che il Mac mostra (⌃ ⌥ ⇧ ⌘).
const FRAME: Record<string, string[]> = {
  clotch: ["Informazioni su clotch", "—", "Impostazioni… ⌘,", "—", "Servizi", "—", "Nascondi clotch ⌘H", "Nascondi altre ⌥⌘H", "Mostra tutto", "—", "Esci da clotch ⌘Q"],
  File: ["Nuova sessione ⌘N", "—", "Chiudi finestra ⌘W"],
  Modifica: ["Annulla ⌘Z", "Ripeti ⇧⌘Z", "—", "Taglia ⌘X", "Copia ⌘C", "Incolla ⌘V", "Incolla e adatta stile ⌥⇧⌘V", "Elimina", "Seleziona tutto ⌘A", "—", "Cerca sessioni ⌘K", "Cerca nella sessione ⌘F", "—", "Voce ›"],
  Vista: ["Mostra o nascondi barra laterale ⌘\\", "—", "Ingrandisci testo ⌘+", "Ingrandisci testo ⌘=", "Riduci testo ⌘-", "Dimensione reale ⌘0", "—", "Attiva/disattiva schermo intero ⌃⌘F"],
  Vai: ["Indietro ⌘[", "Avanti ⌘]", "—", "Prossima sessione in attesa ⌘J", "Scrivi a clotch AI ⇧⌘F"],
  Finestra: ["Riduci a icona ⌘M", "Zoom", "—", "Porta tutto in primo piano"],
  Aiuto: ["Scorciatoie da tastiera ⌘/"],
};
const TASTI: Record<string, string> = { Control: "⌃", Alt: "⌥", Shift: "⇧", Command: "⌘", CommandOrControl: "⌘", Plus: "+" };
const glifi = (a: string) => { const p = a.split("+"); const tasto = p.pop()!; return [...p].sort((x, y) => "⌃⌥⇧⌘".indexOf(TASTI[x]) - "⌃⌥⇧⌘".indexOf(TASTI[y])).map((m) => TASTI[m]).join("") + (TASTI[tasto] ?? tasto); };
const riga = (v: Electron.MenuItemConstructorOptions) =>
  v.type === "separator" ? "—" : [v.label, v.submenu ? "›" : v.accelerator ? glifi(v.accelerator) : ""].filter(Boolean).join(" ");

test("menu dell'app: stesse voci, nello stesso ordine, e stesse scorciatoie dei frame", () => {
  const menu = menuApp().filter((m) => process.platform === "darwin" || m.label !== "clotch");
  assert.deepEqual(menu.map((m) => m.label), Object.keys(FRAME).filter((k) => process.platform === "darwin" || k !== "clotch"));
  for (const m of menu) assert.deepEqual((m.submenu as Electron.MenuItemConstructorOptions[]).map(riga), FRAME[m.label!], m.label);
});

test("scorciatoie cambiate: il menu segue quelle salvate, una tolta esce dal menu (#885)", () => {
  const vista = menuApp({ scorciatoie: { ...PARTENZA.scorciatoie, barra: "⌥⌘S", indietro: null } });
  const voci = (l: string) => (vista.find((m) => m.label === l)!.submenu as Electron.MenuItemConstructorOptions[]).map(riga);
  assert.equal(voci("Vista")[0], "Mostra o nascondi barra laterale ⌥⌘S");
  assert.deepEqual(voci("Vai").slice(0, 2), ["Avanti ⌘]", "—"]);
  for (const t of Object.values(PARTENZA.scorciatoie)) assert.match(acceleratore(t!), /^(Control\+|Alt\+|Shift\+|Command\+)*[^+]+$|Plus$/, t!);
});

test("⌘+ e ⌘-: un passo di «Dimensione del testo», spenti al bordo; ⌘0 torna a Media (#885)", () => {
  assert.equal(dimensioneDopo("Media", 1), "Grande"); assert.equal(dimensioneDopo("Grande", 1), "Grande");
  assert.equal(dimensioneDopo("Piccola", -1), "Piccola"); assert.equal(dimensioneDopo("Grande", 0), "Media"); assert.equal(dimensioneDopo("strana", 1), "Media");
  const scritte: unknown[] = [];
  const vista = menuApp({ dimensione: "Grande" }, (p) => scritte.push(p)).find((m) => m.label === "Vista")!.submenu as Electron.MenuItemConstructorOptions[];
  const v = (l: string) => vista.find((x) => x.label === l)!;
  assert.equal(v("Ingrandisci testo").enabled, false); assert.equal(v("Riduci testo").enabled, true);
  (v("Riduci testo").click as () => void)();
  assert.deepEqual(scritte, [{ dimensione: "Media" }]);
});
