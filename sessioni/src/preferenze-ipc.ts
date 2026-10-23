// Canali IPC delle preferenze e delle azioni su una sessione (#360), nel processo main.
import * as path from "node:path";
import { app, clipboard, shell, type IpcMain } from "electron";
import type { Sessioni } from "./api";
import { apriFinestra } from "./finestra";
import { impostaPreferenze, leggiPreferenze } from "./preferenze";
import type { AzioneSessione } from "./tipi";

export function collegaPreferenze(ipc: IpcMain, invia: (canale: string, dati: unknown) => void, sessioni: Sessioni) {
  const file = path.join(app.getPath("userData"), "preferenze.json");
  ipc.handle("sessioni:preferenze", () => leggiPreferenze(file));
  ipc.handle("sessioni:imposta-preferenze", (_e, id: string, parte) => { invia("sessioni:preferenze", impostaPreferenze(file, String(id), parte ?? {})); });
  ipc.handle("sessioni:azione", (_e, id: string, azione: AzioneSessione) => {
    const s = sessioni.elencoSessioni().sessioni.find((x) => x.id === id);
    if (!s) throw new Error("sessione non trovata");
    switch (azione) {
      case "nuova-finestra": apriFinestra(s.id); return;
      case "copia-id": clipboard.writeText(s.id); return;
      case "copia-cartella": clipboard.writeText(s.cartella); return;
      case "copia-link":
        if (!s.idApp) throw new Error("questa sessione non è dell'app Claude: nessun link");
        clipboard.writeText(`claude://code/continue?session=${s.idApp}`); return;
      case "mostra-nel-finder": shell.showItemInFolder(s.cartella); return;
      default: throw new Error(`azione sconosciuta: ${String(azione)}`);
    }
  });
}
