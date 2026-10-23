// Canali delle impostazioni (#351) che non sono valori salvati: i valori stanno nel file delle preferenze (#368,
// `sessioni:impostazioni`). Qui: cartelle degli account, scelta e apertura di cartelle, versione, avvio col Mac.
// Le impostazioni di Friday non stanno qui: passano dalla casella (`imposta`, `spegni`, contratto v1).
import * as os from "node:os";
import * as path from "node:path";
import type { IpcMain } from "electron";
import type { Sessioni } from "./api";
import type { Indice } from "./indice";
import { nomeProgetto } from "./claude-code";
import { leggiApp, type SessioneApp } from "./desktop";
import { leggiRegistro, type Registro } from "./friday";
import { impostaImpostazioni, leggiImpostazioni } from "./preferenze";
import { quoteUso } from "./quote-uso";
import { accorcia, espandi, trovaRadici } from "./radici";
import type { Archiviata, CartellaAccount, Elenco } from "./tipi";

/** Una riga per cartella: sessioni lette di quell'account, o il perché non si legge (testi del frame 101:10369). */
export function cartelleAccount(percorsi: string[], elenco: Elenco): CartellaAccount[] {
  return percorsi.map((percorso) => {
    const account = percorso.split("/").pop()!;
    const err = elenco.errori.find((e) => e.percorso.split("/").includes(account));
    if (err) return { percorso, dettaglio: `Non leggibile: ${err.messaggio}`, errore: true };
    const n = elenco.sessioni.filter((s) => s.sorgente === "claude-code" && s.account === account).length;
    return { percorso, dettaglio: `${n} sessioni · letta ora`, errore: false };
  });
}

/** Archiviate di tutte le sorgenti, la più recente prima: «<progetto> · <data e ora>» come nel frame 101:32359 («clotch · 22 ott 2026, 18:40»).
 *  Fonti, unite per id di sessione: app Claude (`isArchived`), registro di Friday (`fine` motivo `archiviata`, comando `archivia` riuscito).
 *  La data è il momento dell'archiviazione se il registro lo dà, se no l'ultima attività. Se l'app dice che la sessione non è archiviata, vince l'app. */
export function archiviate(app: SessioneApp[], reg: Pick<Registro, "chat" | "comandi" | "esiti">, fuso?: string): Archiviata[] {
  const per = new Map<string, { titolo: string; progetto: string | null; quando: number | null }>();
  const registro = (id: string, quando: number | null) => {
    const c = reg.chat.get(id);
    per.set(id, { titolo: c?.titolo ?? id, progetto: c?.progetto ? nomeProgetto(c.progetto) : null, quando });
  };
  for (const [id, c] of reg.chat) if (c.fine === "archiviata") registro(id, c.fineT);
  for (const c of reg.comandi) {
    const id = c.args?.chat;
    if (c.cmd === "archivia" && typeof id === "string" && reg.esiti.get(c.id)?.esito === "ok" && !per.has(id)) registro(id, c.t);
  }
  for (const a of app) {
    if (!a.archiviata) { per.delete(a.cliId); continue; }
    const r = per.get(a.cliId);
    per.set(a.cliId, { titolo: a.titolo || r?.titolo || a.cliId, progetto: a.cartella ? nomeProgetto(a.cartella) : r?.progetto ?? null, quando: r?.quando ?? a.ultimaAttivita });
  }
  return [...per].sort((x, y) => (y[1].quando ?? 0) - (x[1].quando ?? 0)).map(([id, v]) => {
    const quando = v.quando == null ? null : new Date(v.quando).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: fuso });
    return { id, titolo: v.titolo, dove: [v.progetto, quando].filter(Boolean).join(" · ") };
  });
}

/** «Elimina dati…» (frame 119:57106): indice, cache e impostazioni dell'app. Le preferenze per sessione e le sessioni originali restano. */
export function eliminaDati(indice: Pick<Indice, "svuota">, filePreferenze: string) {
  indice.svuota();
  impostaImpostazioni(filePreferenze, Object.fromEntries(Object.keys(leggiImpostazioni(filePreferenze)).map((k) => [k, null])));
}

/** Canali di `window.impostazioni` (preload.ts). Le risposte della prova di parità le dà la scena (scena.ts). */
export function collegaImpostazioni(ipc: IpcMain, sessioni: Sessioni, indice: Indice, invia: (canale: string, dati: unknown) => void, home = os.homedir()) {
  // letto qui e non in testa: i test Node importano il file senza il binario Electron scaricato
  const { app, dialog, shell } = require("electron") as typeof import("electron");
  ipc.handle("impostazioni:radici", () => trovaRadici(home).map((r) => accorcia(r.path, home)));
  ipc.handle("impostazioni:cartelle", (_e, percorsi: string[]) => cartelleAccount(percorsi.map(String), sessioni.elencoSessioni()));
  ipc.handle("impostazioni:scegli-cartella", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"], defaultPath: home });
    return r.canceled || !r.filePaths[0] ? null : accorcia(r.filePaths[0], home);
  });
  // shell.openPath torna "" se riesce, se no il perché
  ipc.handle("impostazioni:apri", async (_e, p: string) => { const err = await shell.openPath(espandi(String(p), home)); if (err) throw new Error(err); });
  ipc.handle("impostazioni:versione", () => app.getVersion());
  ipc.handle("impostazioni:avvio", (_e, acceso: boolean) => app.setLoginItemSettings({ openAtLogin: acceso === true }));
  ipc.handle("impostazioni:elimina-dati", () => {
    eliminaDati(indice, path.join(app.getPath("userData"), "preferenze.json"));
    invia("sessioni:impostazioni", {});
    sessioni.impostazioni({});
    void indice.metti(sessioni.elencoSessioni().sessioni, true); // «Sessioni le rilegge da capo»
  });
  ipc.handle("impostazioni:uso", () => quoteUso());
  ipc.handle("impostazioni:archiviate", () => archiviate(leggiApp(home, []), leggiRegistro(home, process.env)));
  // shortcut: nessun CHANGELOG né aggiornatore nel repo, quindi niente note e niente «Controlla aggiornamenti»; quando ci sono, qui la fonte
  ipc.handle("impostazioni:novita", () => null);
  ipc.handle("impostazioni:aggiornamenti", () => false);
}
