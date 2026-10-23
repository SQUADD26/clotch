import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { Aggiornamento, CasellaApi, FridayApi, ImpostazioniApi, PreferenzeSessione, SessioniApi } from "./tipi";

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

const casella: CasellaApi = {
  scegli: () => ipcRenderer.invoke("casella:scegli"),
  descrivi: (percorsi) => ipcRenderer.invoke("casella:descrivi", percorsi),
  percorso: (file) => { try { return webUtils.getPathForFile(file); } catch { return ""; } },
  immagine: (da) => ipcRenderer.invoke("casella:immagine", da),
  copiaImmagine: (da) => ipcRenderer.invoke("casella:copia-immagine", da),
  salvaImmagine: (da, nome) => ipcRenderer.invoke("casella:salva-immagine", da, nome),
  skill: (account) => ipcRenderer.invoke("casella:skill", account),
};
contextBridge.exposeInMainWorld("casella", casella);
