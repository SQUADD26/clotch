// Comandi che l'app fa da sé, senza passare dalla casella di clotch AI: fermare la propria voce e parlare con Clotch. Clotch li ascolta
// come notifiche distribuite del Mac nella stessa sessione di login (come `com.squadd.clotch.dettatura` di AppDelegate.swift).
import { fermaVoce } from "./voce-app";
import { provaSilenziosa } from "./modalita-prova";
import type { EsitoComando } from "./comandi";

export const COMANDI_APP = ["voce_ferma", "clotch_dettatura", "clotch_interrompi_voce"] as const;
export type ComandoApp = (typeof COMANDI_APP)[number];
export const eComandoApp = (c: string): c is ComandoApp => (COMANDI_APP as readonly string[]).includes(c);

// shortcut: `clotch_interrompi_voce` esiste solo da questa parte; Clotch non lo ascolta ancora (serve un osservatore in AppDelegate.swift che chiami VoiceSpeaker.shared.hush()).
const SEGNALE = { clotch_dettatura: "dettatura", clotch_interrompi_voce: "interrompi-voce" } as const;

export async function eseguiComandoApp(cmd: ComandoApp): Promise<EsitoComando> {
  if (cmd === "voce_ferma") { fermaVoce(); return { id: "app", esito: "ok", testo: "" }; }
  if (provaSilenziosa() || process.platform !== "darwin") return { id: null, esito: "non_scritto", testo: "Il segnale a Clotch parte solo dal Mac." };
  const { systemPreferences } = await import("electron");
  systemPreferences.postNotification(`com.squadd.clotch.${SEGNALE[cmd]}`, {}, true);
  return { id: "app", esito: "ok", testo: "" };
}
