// Impostazioni dell'app (#351): un file JSON in userData, scritto solo dal main (tmp + rename, come la casella di Friday).
// Le impostazioni di Friday non stanno qui: passano dalla casella (`imposta`, `spegni`, contratto v1).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { app, dialog, shell, type IpcMain } from "electron";
import { trovaRadici } from "./radici";

export type Valori = Record<string, unknown>;

/** Legge il file; mancante = nessuna scelta ancora (valgono i valori del disegno, nel renderer). */
export function leggiImpostazioni(file: string): Valori {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`Impostazioni non leggibili: ${file}`);
  }
}

/** Unisce `parte` alle impostazioni salvate e riscrive il file intero; torna il risultato. */
export function scriviImpostazioni(file: string, parte: Valori): Valori {
  if (!parte || typeof parte !== "object" || Array.isArray(parte)) throw new Error("Impostazioni non valide");
  const nuove = { ...leggiImpostazioni(file), ...parte };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(nuove, null, 1));
  fs.renameSync(tmp, file);
  return nuove;
}

/** `~/…` -> percorso assoluto, per aprire una cartella scritta come nel disegno. */
export const espandi = (p: string, home = os.homedir()) => (p === "~" || p.startsWith("~/") ? path.join(home, p.slice(1)) : p);


/** `/Users/x/.claude-y` -> `~/.claude-y`, come lo scrive il disegno. */
export const accorcia = (p: string, home = os.homedir()) => (p === home ? "~" : p.startsWith(home + path.sep) ? "~" + p.slice(home.length) : p);

/** Canali del renderer (`window.impostazioni`, preload.ts). `apriAllAvvio` è anche la voce «Elementi di login» del Mac. */
export function collegaImpostazioni(ipc: IpcMain, file: string, home = os.homedir()) {
  ipc.handle("impostazioni:leggi", () => leggiImpostazioni(file));
  ipc.handle("impostazioni:scrivi", (_e, parte: Valori) => {
    const nuove = scriviImpostazioni(file, parte);
    if ("apriAllAvvio" in parte) app.setLoginItemSettings({ openAtLogin: parte.apriAllAvvio === true });
    return nuove;
  });
  ipc.handle("impostazioni:radici", () => trovaRadici(home).map((r) => ({ percorso: accorcia(r.path, home), account: r.account })));
  ipc.handle("impostazioni:scegli-cartella", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"], defaultPath: home });
    return r.canceled || !r.filePaths[0] ? null : accorcia(r.filePaths[0], home);
  });
  // shell.openPath torna "" se riesce, se no il perché
  ipc.handle("impostazioni:apri", async (_e, p: string) => { const err = await shell.openPath(espandi(String(p), home)); if (err) throw new Error(err); });
  ipc.handle("impostazioni:versione", () => app.getVersion());
}
