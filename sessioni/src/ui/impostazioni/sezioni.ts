// Voci della «Navigazione impostazioni» (101:17197), nell'ordine e con le icone del frame.
import type { NomeIcona } from "../base/Icona";

export const SEZIONI = [
  ["generale", "Generale", "impostazioni"],
  ["aspetto", "Aspetto", "tavolozza"],
  ["notifiche", "Notifiche", "campana"],
  ["clotch-ai", "clotch AI", "scintille"],
  ["scorciatoie", "Scorciatoie", "tastiera"],
  ["sorgenti", "Sorgenti", "computer"],
  ["account", "Account", "persona"],
  ["uso", "Uso", "grafico"],
  ["archiviate", "Sessioni archiviate", "archivia"],
  ["archiviazione", "Archiviazione", "disco"],
  ["dati", "Dati", "scudo"],
  ["info", "Info", "info"],
  ["clotch", "clotch", "schermo"],
] as const satisfies readonly (readonly [string, string, NomeIcona])[];

export type Sezione = (typeof SEZIONI)[number][0];
