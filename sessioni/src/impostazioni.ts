// Canali delle impostazioni (#351) che non sono valori salvati: i valori stanno nel file delle preferenze (#368,
// `sessioni:impostazioni`). Qui: cartelle degli account, scelta e apertura di cartelle, versione, avvio col Mac.
// Le impostazioni di Friday non stanno qui: passano dalla casella (`imposta`, `spegni`, contratto v1).
import * as os from "node:os";
import * as path from "node:path";
import { app, dialog, shell, type IpcMain } from "electron";
import type { Sessioni } from "./api";
import type { Indice } from "./indice";
import { impostaImpostazioni, leggiImpostazioni } from "./preferenze";
import { quoteUso } from "./quote-uso";
import { accorcia, espandi, trovaRadici } from "./radici";
import type { CartellaAccount, Elenco } from "./tipi";

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

/** «Elimina dati…» (frame 119:57106): indice, cache e impostazioni dell'app. Le preferenze per sessione e le sessioni originali restano. */
export function eliminaDati(indice: Pick<Indice, "svuota">, filePreferenze: string) {
  indice.svuota();
  impostaImpostazioni(filePreferenze, Object.fromEntries(Object.keys(leggiImpostazioni(filePreferenze)).map((k) => [k, null])));
}

/** Canali di `window.impostazioni` (preload.ts). Le risposte della prova di parità le dà la scena (scena.ts). */
export function collegaImpostazioni(ipc: IpcMain, sessioni: Sessioni, indice: Indice, invia: (canale: string, dati: unknown) => void, home = os.homedir()) {
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
  // nessuna fonte ancora: archiviate #375
  ipc.handle("impostazioni:archiviate", () => []);
  // shortcut: nessun CHANGELOG né aggiornatore nel repo, quindi niente note e niente «Controlla aggiornamenti»; quando ci sono, qui la fonte
  ipc.handle("impostazioni:novita", () => null);
  ipc.handle("impostazioni:aggiornamenti", () => false);
}
