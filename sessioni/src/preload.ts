import { contextBridge, ipcRenderer } from "electron";
import type { Aggiornamento, SessioniApi } from "./tipi";

const api: SessioniApi = {
  elencoSessioni: () => ipcRenderer.invoke("sessioni:elenco"),
  messaggi: (id, pagina) => ipcRenderer.invoke("sessioni:messaggi", id, pagina),
  onAggiornamento: (cb) => {
    const f = (_e: unknown, a: Aggiornamento) => cb(a);
    ipcRenderer.on("sessioni:aggiornamento", f);
    return () => ipcRenderer.removeListener("sessioni:aggiornamento", f);
  },
};
contextBridge.exposeInMainWorld("sessioni", api);
