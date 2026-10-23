import { contextBridge, ipcRenderer } from "electron";
import type { Aggiornamento, ClotchAiApi, ImpostazioniApi, PreferenzeSessione, SessioniApi } from "./tipi";

const api: SessioniApi = {
  elencoSessioni: () => ipcRenderer.invoke("sessioni:elenco"),
  messaggi: (id, pagina, opzioni) => ipcRenderer.invoke("sessioni:messaggi", id, pagina, opzioni),
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

const clotchAi: ClotchAiApi = {
  comando: (cmd, args) => ipcRenderer.invoke("clotch-ai:comando", cmd, args),
  registro: () => ipcRenderer.invoke("clotch-ai:registro"),
  avvia: () => ipcRenderer.invoke("clotch-ai:avvia"),
  onRegistro: (cb) => {
    const f = (_e: unknown, r: unknown) => cb(r);
    ipcRenderer.on("clotch-ai:registro", f);
    return () => ipcRenderer.removeListener("clotch-ai:registro", f);
  },
};
contextBridge.exposeInMainWorld("clotchAi", clotchAi);

const impostazioni: ImpostazioniApi = {
  radici: () => ipcRenderer.invoke("impostazioni:radici"),
  cartelle: (percorsi) => ipcRenderer.invoke("impostazioni:cartelle", percorsi),
  scegliCartella: () => ipcRenderer.invoke("impostazioni:scegli-cartella"),
  apri: (percorso) => ipcRenderer.invoke("impostazioni:apri", percorso),
  versione: () => ipcRenderer.invoke("impostazioni:versione"),
  avvio: (acceso) => ipcRenderer.invoke("impostazioni:avvio", acceso),
  uso: () => ipcRenderer.invoke("impostazioni:uso"),
  archiviate: () => ipcRenderer.invoke("impostazioni:archiviate"),
  eliminaDati: () => ipcRenderer.invoke("impostazioni:elimina-dati"),
  novita: () => ipcRenderer.invoke("impostazioni:novita"),
  aggiornamenti: (fai) => ipcRenderer.invoke("impostazioni:aggiornamenti", fai),
};
contextBridge.exposeInMainWorld("impostazioni", impostazioni);
