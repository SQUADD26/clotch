import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { Aggiornamento, CasellaApi, ClotchAiApi, ImpostazioniApi, NuovaSessioneApi, PreferenzeSessione, SessioniApi } from "./tipi";

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
  menuBarra: (aperta) => ipcRenderer.send("sessioni:menu-barra", aperta),
  onMenu: (cb) => {
    const f = (_e: unknown, a: string) => cb(a);
    ipcRenderer.on("sessioni:menu", f);
    return () => ipcRenderer.removeListener("sessioni:menu", f);
  },
  impostazioni: () => ipcRenderer.invoke("sessioni:impostazioni"),
  impostaImpostazioni: (parte) => ipcRenderer.invoke("sessioni:imposta-impostazioni", parte),
  onImpostazioni: (cb) => {
    const f = (_e: unknown, i: Record<string, unknown>) => cb(i);
    ipcRenderer.on("sessioni:impostazioni", f);
    return () => ipcRenderer.removeListener("sessioni:impostazioni", f);
  },
  cerca: (testo) => ipcRenderer.invoke("sessioni:cerca", testo),
  comandi: (id) => ipcRenderer.invoke("sessioni:comandi", id),
  modelli: () => ipcRenderer.invoke("sessioni:modelli"),
  file: (id, testo) => ipcRenderer.invoke("sessioni:file", id, testo),
  spazio: () => ipcRenderer.invoke("sessioni:spazio"),
  info: (id) => ipcRenderer.invoke("sessioni:info", id),
  ricostruisci: () => ipcRenderer.invoke("sessioni:ricostruisci"),
  svuota: () => ipcRenderer.invoke("sessioni:svuota"),
};
contextBridge.exposeInMainWorld("sessioni", api);

const clotchAi: ClotchAiApi = {
  comando: (cmd, args) => ipcRenderer.invoke("clotch-ai:comando", cmd, args),
  registro: () => ipcRenderer.invoke("clotch-ai:registro"),
  avvia: () => ipcRenderer.invoke("clotch-ai:avvia"),
  voce: () => ipcRenderer.invoke("clotch-ai:voce"),
  onVoce: (cb) => {
    const f = (_e: unknown, parla: boolean) => cb(parla);
    ipcRenderer.on("clotch-ai:voce", f);
    return () => ipcRenderer.removeListener("clotch-ai:voce", f);
  },
  dettatura: (avvia) => ipcRenderer.invoke("clotch-ai:dettatura", avvia),
  onDettatura: (cb) => {
    const f = (_e: unknown, e: Parameters<typeof cb>[0]) => cb(e);
    ipcRenderer.on("clotch-ai:dettatura", f);
    return () => ipcRenderer.removeListener("clotch-ai:dettatura", f);
  },
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
  profilo: () => ipcRenderer.invoke("impostazioni:profilo"),
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
  copia: (percorsi) => ipcRenderer.invoke("casella:copia", percorsi),
  incolla: (mime, byte) => ipcRenderer.invoke("casella:incolla", mime, byte),
  immagine: (da) => ipcRenderer.invoke("casella:immagine", da),
  copiaImmagine: (da) => ipcRenderer.invoke("casella:copia-immagine", da),
  salvaImmagine: (da, nome) => ipcRenderer.invoke("casella:salva-immagine", da, nome),
  mostra: (percorso) => ipcRenderer.invoke("casella:mostra", percorso),
  skill: (account) => ipcRenderer.invoke("casella:skill", account),
};
contextBridge.exposeInMainWorld("casella", casella);

const nuovaSessione: NuovaSessioneApi = {
  cartelle: () => ipcRenderer.invoke("nuova:cartelle"),
  contesto: (cartella) => ipcRenderer.invoke("nuova:contesto", cartella),
  scegliChiave: () => ipcRenderer.invoke("nuova:scegli-chiave"),
  scegliCartella: () => ipcRenderer.invoke("nuova:scegli-cartella"),
};
contextBridge.exposeInMainWorld("nuovaSessione", nuovaSessione);
