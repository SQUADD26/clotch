// «Nuova sessione» (#468), lato processo principale: cartelle recenti e rami git in sola lettura, più il dialogo per scegliere il file della chiave SSH.
// La sessione la apre clotch AI (comando `nuova_sessione`); le macchine SSH le dà il motore (comando `macchine`).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { IpcMain } from "electron";
import type { CartellaAvvio, ContestoCartella, Sessione } from "./tipi";

const nomeDi = (percorso: string) => path.basename(percorso) || percorso;

/** Le cartelle delle sessioni già lette, dalla più recente, senza doppioni. */
export function cartelleRecenti(sessioni: Pick<Sessione, "cartella" | "ultimaAttivita">[], limite = 6): CartellaAvvio[] {
  const viste = new Set<string>();
  return [...sessioni].sort((a, b) => b.ultimaAttivita - a.ultimaAttivita).flatMap((s) => {
    if (!s.cartella || viste.has(s.cartella)) return [];
    viste.add(s.cartella);
    return [{ percorso: s.cartella, nome: nomeDi(s.cartella) }];
  }).slice(0, limite);
}

const git = (cartella: string, ...args: string[]) => new Promise<string | null>((ok) =>
  execFile("git", ["-C", cartella, ...args], { timeout: 5000, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }, (e, out) => ok(e ? null : out.trim())));

/** Rami locali di una cartella (solo `git rev-parse` e `git branch`: non cambia niente). */
export async function contestoGit(cartella: string): Promise<ContestoCartella> {
  const vuoto = { git: false, rami: [], predefinito: null };
  if (!path.isAbsolute(cartella) || !fs.existsSync(cartella) || (await git(cartella, "rev-parse", "--is-inside-work-tree")) !== "true") return vuoto;
  const rami = ((await git(cartella, "branch", "--format=%(refname:short)")) ?? "").split("\n").filter((r) => r && !r.startsWith("("));
  const attuale = (await git(cartella, "branch", "--show-current")) || null;
  return { git: true, rami, predefinito: ["dev", "main", "master"].find((r) => rami.includes(r)) ?? attuale ?? rami[0] ?? null };
}

export function collegaNuovaSessione(ipc: IpcMain, elenco: () => Pick<Sessione, "cartella" | "ultimaAttivita">[], home = os.homedir()) {
  const { BrowserWindow, dialog } = require("electron") as typeof import("electron"); // i test Node importano il file senza il binario Electron
  ipc.handle("nuova:cartelle", () => ({ recenti: cartelleRecenti(elenco()), casa: home }));
  ipc.handle("nuova:contesto", (_e, cartella: unknown) => contestoGit(typeof cartella === "string" ? cartella : ""));
  // della chiave serve solo il percorso: il file non si legge mai
  ipc.handle("nuova:scegli-chiave", async (e): Promise<string | null> => {
    const opzioni: Electron.OpenDialogOptions = { properties: ["openFile", "showHiddenFiles"], defaultPath: path.join(home, ".ssh") };
    const padre = BrowserWindow.fromWebContents(e.sender);
    const r = await (padre ? dialog.showOpenDialog(padre, opzioni) : dialog.showOpenDialog(opzioni));
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });
  ipc.handle("nuova:scegli-cartella", async (e): Promise<CartellaAvvio | null> => {
    const opzioni: Electron.OpenDialogOptions = { properties: ["openDirectory"], defaultPath: home };
    const padre = BrowserWindow.fromWebContents(e.sender);
    const r = await (padre ? dialog.showOpenDialog(padre, opzioni) : dialog.showOpenDialog(opzioni));
    return r.canceled || !r.filePaths[0] ? null : { percorso: r.filePaths[0], nome: nomeDi(r.filePaths[0]) };
  });
}
