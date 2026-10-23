// Canali IPC dell'indice di ricerca (#368), nel processo main. Al via controlla tutte le sessioni, una per giro del ciclo.
import { app, type IpcMain } from "electron";
import type { Sessioni } from "./api";
import { Indice } from "./indice";

export function collegaIndice(ipc: IpcMain, sessioni: Sessioni): Indice {
  const indice = new Indice(app.getPath("userData"));
  ipc.handle("sessioni:cerca", (_e, testo: string) => indice.cerca(String(testo ?? "")));
  ipc.handle("sessioni:spazio", () => indice.spazio());
  ipc.handle("sessioni:ricostruisci", () => indice.ricostruisci(sessioni.elencoSessioni().sessioni));
  ipc.handle("sessioni:svuota", () => indice.svuota());
  setImmediate(() => indice.metti(sessioni.elencoSessioni().sessioni, true));
  return indice;
}
