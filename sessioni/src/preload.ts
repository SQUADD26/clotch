import { contextBridge, ipcRenderer } from "electron";
import type { Aggiornamento, FridayApi, PreferenzeSessione, SessioniApi } from "./tipi";

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
  impostazioni: () => ipcRenderer.invoke("sessioni:impostazioni"),
  impostaImpostazioni: (parte) => ipcRenderer.invoke("sessioni:imposta-impostazioni", parte),
  onImpostazioni: (cb) => {
    const f = (_e: unknown, i: Record<string, unknown>) => cb(i);
    ipcRenderer.on("sessioni:impostazioni", f);
    return () => ipcRenderer.removeListener("sessioni:impostazioni", f);
  },
  cerca: (testo) => ipcRenderer.invoke("sessioni:cerca", testo),
  spazio: () => ipcRenderer.invoke("sessioni:spazio"),
  ricostruisci: () => ipcRenderer.invoke("sessioni:ricostruisci"),
  svuota: () => ipcRenderer.invoke("sessioni:svuota"),
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
