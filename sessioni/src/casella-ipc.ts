// Canali IPC dei menu della casella (#437), nel processo main: comandi con «/» e file con «@» di una sessione.
import * as os from "node:os";
import * as path from "node:path";
import type { IpcMain } from "electron";
import type { Sessioni } from "./api";
import { cercaFile, comandiDi } from "./casella-dati";

export function collegaCasella(ipc: IpcMain, sessioni: Sessioni, home = os.homedir()) {
  const sessione = (id: unknown) => {
    const s = sessioni.elencoSessioni().sessioni.find((x) => x.id === String(id));
    if (!s) throw new Error("sessione non trovata");
    return s;
  };
  ipc.handle("sessioni:comandi", (_e, id: string) => {
    const s = sessione(id);
    return comandiDi(/^\.claude(-[\w.-]+)?$/.test(s.account) ? path.join(home, s.account) : null, s.cartella);
  });
  ipc.handle("sessioni:file", (_e, id: string, testo: string) => cercaFile(sessione(id).cartella, String(testo ?? "")));
}
