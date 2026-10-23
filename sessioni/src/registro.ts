// Registro degli errori del main (#409): un file al giorno nella «cartella del registro» delle impostazioni, una riga per errore.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const CARTELLA_REGISTRO = "~/Library/Logs/clotch"; // come PARTENZA.cartellaRegistro dell'interfaccia
const due = (n: number) => String(n).padStart(2, "0");
const giorno = (o: Date) => `${o.getFullYear()}-${due(o.getMonth() + 1)}-${due(o.getDate())}`;

/** «2026-10-23 14:05:09 messaggio»; il messaggio resta su una riga sola. */
export const rigaRegistro = (ora: Date, messaggio: string) =>
  `${giorno(ora)} ${due(ora.getHours())}:${due(ora.getMinutes())}:${due(ora.getSeconds())} ${messaggio.replace(/\s*\n\s*/g, " ")}\n`;

/** Aggiunge la riga al file del giorno (`<cartella>/<anno-mese-giorno>.log`), creando la cartella. Non lancia mai: il registro non deve far cadere l'app. */
export function scriviRegistro(cartella: string, messaggio: string, ora = new Date()) {
  try {
    const dir = cartella.replace(/^~(?=$|\/)/, os.homedir());
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `${giorno(ora)}.log`), rigaRegistro(ora, messaggio));
  } catch { /* shortcut: se il disco rifiuta la riga si perde, quando serve la si manda anche a console */ }
}

export const testoErrore = (e: unknown) => (e instanceof Error ? e.stack ?? e.message : String(e));
