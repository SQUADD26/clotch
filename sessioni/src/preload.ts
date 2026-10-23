import { contextBridge, ipcRenderer } from "electron";
import type { Aggiornamento, FridayApi, SessioniApi } from "./tipi";

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

const friday: FridayApi = {
  comando: (cmd, args) => ipcRenderer.invoke("friday:comando", cmd, args),
  registro: () => ipcRenderer.invoke("friday:registro"),
  avvia: () => ipcRenderer.invoke("friday:avvia"),
  onRegistro: (cb) => {
    const f = (_e: unknown, r: unknown) => cb(r);
    ipcRenderer.on("friday:registro", f);
    return () => ipcRenderer.removeListener("friday:registro", f);
  },
};
contextBridge.exposeInMainWorld("friday", friday);
