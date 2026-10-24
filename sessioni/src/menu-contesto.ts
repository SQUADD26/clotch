// Tasto destro su testo e campi (#886, HIG «Context menus»): correzioni, Copia link, Taglia/Copia/Incolla. Le righe con un menu loro
// fanno preventDefault sul contextmenu e qui non arrivano.
import { clipboard, Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

export function menuContestuale(w: BrowserWindow) {
  w.webContents.on("context-menu", (_e, p) => {
    const voci: MenuItemConstructorOptions[] = p.dictionarySuggestions.slice(0, 5).map((s) => ({ label: s, click: () => w.webContents.replaceMisspelling(s) }));
    if (p.misspelledWord) voci.push({ label: "Impara ortografia", click: () => w.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, { type: "separator" });
    if (p.linkURL) voci.push({ label: "Copia link", click: () => clipboard.writeText(p.linkURL) }, { type: "separator" });
    // Electron scrive i ruoli in inglese: etichette come nel menu Modifica
    const copia: MenuItemConstructorOptions = { role: "copy", label: "Copia", enabled: p.editFlags.canCopy };
    if (p.isEditable) voci.push({ role: "cut", label: "Taglia", enabled: p.editFlags.canCut }, copia, { role: "paste", label: "Incolla", enabled: p.editFlags.canPaste },
      { type: "separator" }, { role: "selectAll", label: "Seleziona tutto" });
    else if (p.selectionText.trim()) voci.push(copia);
    if (voci.at(-1)?.type === "separator") voci.pop();
    if (voci.length) Menu.buildFromTemplate(voci).popup({ window: w });
  });
}
