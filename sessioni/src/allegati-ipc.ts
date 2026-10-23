// Canali `casella:*` (#437): file e cartelle da allegare, immagini del filo, copia e «Salva con nome», skill. La logica sta in allegati.ts.
import { BrowserWindow, clipboard, ClipboardItem, dialog, nativeImage, type IpcMain } from "electron";
import * as fs from "node:fs";
import { comeIndirizzo, descrivi, leggiImmagine, leggiSkill } from "./allegati";
import { provaSilenziosa } from "./modalita-prova";
import type { DaImmagine } from "./tipi";

export function collegaAllegati(ipc: IpcMain, home: string, fileSessione: (id: string) => string | null) {
  const finestra = (e: { sender: Electron.WebContents }) => BrowserWindow.fromWebContents(e.sender) ?? undefined;
  // la prova non apre finestre di scelta né tocca gli appunti del Mac
  const silenzio = provaSilenziosa();
  ipc.handle("casella:scegli", async (e) => {
    if (silenzio) return [];
    const opzioni: Electron.OpenDialogOptions = { properties: ["openFile", "openDirectory", "multiSelections"], defaultPath: home };
    const r = await (finestra(e) ? dialog.showOpenDialog(finestra(e)!, opzioni) : dialog.showOpenDialog(opzioni));
    return r.canceled ? [] : descrivi(r.filePaths);
  });
  ipc.handle("casella:descrivi", (_e, percorsi: unknown) => descrivi(percorsi));
  ipc.handle("casella:immagine", async (_e, da: DaImmagine) => {
    const i = await leggiImmagine(da, fileSessione);
    return i ? comeIndirizzo(i) : null;
  });
  ipc.handle("casella:copia-immagine", async (_e, da: DaImmagine) => {
    const i = silenzio ? null : await leggiImmagine(da, fileSessione);
    if (!i) return false;
    // gli appunti prendono PNG: ogni altro formato passa da nativeImage
    const png = nativeImage.createFromBuffer(Buffer.from(i.base64, "base64")).toPNG();
    if (!png.length) return false;
    await clipboard.write([new ClipboardItem({ "image/png": new Blob([new Uint8Array(png)], { type: "image/png" }) })]);
    return true;
  });
  ipc.handle("casella:salva-immagine", async (e, da: DaImmagine, nome: unknown) => {
    const i = silenzio ? null : await leggiImmagine(da, fileSessione);
    if (!i) return false;
    const opzioni: Electron.SaveDialogOptions = { defaultPath: String(nome).replace(/[\\/]/g, "_") };
    const r = await (finestra(e) ? dialog.showSaveDialog(finestra(e)!, opzioni) : dialog.showSaveDialog(opzioni));
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, Buffer.from(i.base64, "base64"));
    return true;
  });
  ipc.handle("casella:skill", (_e, account: string) => leggiSkill(home, account));
}
