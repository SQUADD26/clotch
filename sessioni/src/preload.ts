import { contextBridge, ipcRenderer } from "electron";
import type { Aggiornamento, FridayApi, ImpostazioniApi, PreferenzeSessione, SessioniApi } from "./tipi";

const api: SessioniApi = {
  elencoSessioni: () => ipcRenderer.invoke("sessioni:elenco"),
  messaggi: (id, pagina) => ipcRenderer.invoke("sessioni:messaggi", id, pagina),
  onAggiornamento: (cb) => {
    const f = (_e: unknown, a: Aggiornamento) => cb(a);
    ipcRenderer.on("sessioni:aggiornamento", f);
    return () => ipcRenderer.removeListener("sessioni:aggiornamento", f);
  },
  preferenze: () => ipcRenderer.invoke("sessioni:preferenze"),
  impostaPreferenze: (id, parte) => ipcRenderer.invoke("sessioni:imposta-preferenze", id, parte),
  onPreferenze: (cb) => {
    const f = (_e: unknown, p: Record<string, PreferenzeSessione>) => cb(p);
    ipcRenderer.on("sessioni:preferenze", f);
    return () => ipcRenderer.removeListener("sessioni:preferenze", f);
  },
  azione: (id, azione) => ipcRenderer.invoke("sessioni:azione", id, azione),
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

const impostazioni: ImpostazioniApi = {
  leggi: () => ipcRenderer.invoke("impostazioni:leggi"),
  scrivi: (parte) => ipcRenderer.invoke("impostazioni:scrivi", parte),
  radici: () => ipcRenderer.invoke("impostazioni:radici"),
  scegliCartella: () => ipcRenderer.invoke("impostazioni:scegli-cartella"),
  apri: (percorso) => ipcRenderer.invoke("impostazioni:apri", percorso),
  versione: () => ipcRenderer.invoke("impostazioni:versione"),
};
contextBridge.exposeInMainWorld("impostazioni", impostazioni);
