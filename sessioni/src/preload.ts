import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { Aggiornamento, CasellaApi, ClotchAiApi, ImpostazioniApi, NuovaSessioneApi, PreferenzeSessione, SessioniApi } from "./tipi";

/** Un solo ascoltatore IPC per canale, con tutti i componenti che lo chiedono dietro: tanti `usePreferenze()` non superano
 *  il limite di 10 ascoltatori dell'EventEmitter (avviso MaxListenersExceeded). */
function ascolta<T>(canale: string) {
  const chi = new Set<(d: T) => void>();
  let acceso = false;
  return (cb: (d: T) => void) => {
    if (!acceso) { acceso = true; ipcRenderer.on(canale, (_e, d: T) => chi.forEach((f) => f(d))); }
    chi.add(cb);
    return () => { chi.delete(cb); };
  };
}

const api: SessioniApi = {
  elencoSessioni: () => ipcRenderer.invoke("sessioni:elenco"),
  messaggi: (id, pagina, opzioni) => ipcRenderer.invoke("sessioni:messaggi", id, pagina, opzioni),
  onAggiornamento: ascolta<Aggiornamento>("sessioni:aggiornamento"),
  preferenze: () => ipcRenderer.invoke("sessioni:preferenze"),
  impostaPreferenze: (id, parte) => ipcRenderer.invoke("sessioni:imposta-preferenze", id, parte),
  onPreferenze: ascolta<Record<string, PreferenzeSessione>>("sessioni:preferenze"),
  azione: (id, azione) => ipcRenderer.invoke("sessioni:azione", id, azione),
  menuBarra: (aperta) => ipcRenderer.send("sessioni:menu-barra", aperta),
  onMenu: ascolta<string>("sessioni:menu"),
  impostazioni: () => ipcRenderer.invoke("sessioni:impostazioni"),
  impostaImpostazioni: (parte) => ipcRenderer.invoke("sessioni:imposta-impostazioni", parte),
  onImpostazioni: ascolta<Record<string, unknown>>("sessioni:impostazioni"),
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
  onVoce: ascolta<boolean>("clotch-ai:voce"),
  dettatura: (avvia) => ipcRenderer.invoke("clotch-ai:dettatura", avvia),
  onDettatura: ascolta<import("./dettatura-app").EventoDettatura>("clotch-ai:dettatura"),
  onRegistro: ascolta<unknown>("clotch-ai:registro"),
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
