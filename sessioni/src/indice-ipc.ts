// Canali IPC dell'indice di ricerca (#368), nel processo main. Al via controlla tutte le sessioni, una per giro del ciclo.
import { app, type IpcMain } from "electron";
import type { Sessioni } from "./api";
import { Indice } from "./indice";
import { lavoro } from "./lavori";

/** `quando`: il controllo iniziale parte solo dopo (main.ts: dopo la prima finestra). */
export function collegaIndice(ipc: IpcMain, sessioni: Sessioni, quando: Promise<void> = Promise.resolve()): Indice {
  const indice = new Indice(app.getPath("userData"), 2000, false);
  indice.lavoraFuori((s, v) => lavoro({ tipo: "voce", s: { id: s.id, file: s.file, sorgente: s.sorgente, titolo: s.titolo }, v }));
  ipc.handle("sessioni:cerca", (_e, testo: string) => indice.cerca(String(testo ?? "")));
  ipc.handle("sessioni:spazio", () => indice.spazio());
  ipc.handle("sessioni:ricostruisci", () => indice.ricostruisci(sessioni.elencoSessioni().sessioni));
  ipc.handle("sessioni:svuota", () => indice.svuota());
  void quando.then(() => indice.carica()).then(() => indice.metti(sessioni.elencoSessioni().sessioni, true));
  return indice;
}
