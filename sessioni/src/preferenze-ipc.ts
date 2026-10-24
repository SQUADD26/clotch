// Canali IPC delle preferenze, delle impostazioni dell'app e delle azioni su una sessione (#360, #368), nel processo main.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { app, clipboard, shell, type IpcMain } from "electron";
import type { Sessioni } from "./api";
import { apriFinestra } from "./finestra";
import { impostaImpostazioni, impostaPreferenze, leggiImpostazioni, leggiPreferenze } from "./preferenze";
import { applicaMotore } from "./impostazioni-motore";
import { provaSilenziosa } from "./modalita-prova";
import type { AzioneSessione } from "./tipi";

export function collegaPreferenze(ipc: IpcMain, invia: (canale: string, dati: unknown) => void, sessioni: Sessioni) {
  const file = path.join(app.getPath("userData"), "preferenze.json");
  ipc.handle("sessioni:preferenze", () => leggiPreferenze(file));
  ipc.handle("sessioni:imposta-preferenze", (_e, id: string, parte) => { invia("sessioni:preferenze", impostaPreferenze(file, String(id), parte ?? {})); });
  ipc.handle("sessioni:impostazioni", () => leggiImpostazioni(file));
  try { sessioni.impostazioni(leggiImpostazioni(file)); } catch { /* file rotto: elenco senza filtro, il file non si tocca */ }
  ipc.handle("sessioni:imposta-impostazioni", (_e, parte) => {
    const salvate = impostaImpostazioni(file, parte ?? {});
    if (!provaSilenziosa()) applicaMotore(parte ?? {}); // voce e dettatura del notch: i file che il notch legge (#534)
    invia("sessioni:impostazioni", salvate);
    sessioni.impostazioni(salvate); // l'elenco segue le impostazioni (#404)
  });
  ipc.handle("sessioni:azione", (_e, id: string, azione: AzioneSessione) => {
    const s = sessioni.elencoSessioni().sessioni.find((x) => x.id === id);
    if (!s) throw new Error("sessione non trovata");
    switch (azione) {
      case "nuova-finestra": apriFinestra(s.id); return;
      case "copia-id": return clipboard.writeText(s.id);
      case "copia-cartella": return clipboard.writeText(s.cartella);
      case "copia-link":
        if (!s.idApp) throw new Error("questa sessione non è dell’app Claude: nessun link");
        return clipboard.writeText(`claude://code/continue?session=${s.idApp}`);
      case "mostra-nel-finder": shell.showItemInFolder(s.file && fs.existsSync(s.file) ? s.file : s.cartella); return; // il file della sessione, se c'è
      case "apri-terminale":
        if (!s.cartella) throw new Error("questa sessione non ha una cartella");
        return new Promise<void>((ok, ko) => execFile("open", ["-a", "Terminal", s.cartella], (e) => (e ? ko(e) : ok())));
      default: throw new Error(`azione sconosciuta: ${String(azione)}`);
    }
  });
}
