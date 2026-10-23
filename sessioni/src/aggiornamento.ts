// «Verifica aggiornamenti…» e «Aggiorna» (frame 101:22137). Non c'è un server di aggiornamenti (Sparkle spento, ARCHITECTURE.md):
// una versione nuova è il package.json dell'app sul disco cambiato dopo l'avvio (build rifatta o app sostituita dall'installatore).
// «Aggiorna» riapre l'app, che riparte dal codice nuovo. Nella prova silenziosa non riapre mai niente.
import * as fs from "node:fs";
import * as path from "node:path";

/** Versione e data del package.json di `dir`; null se non si legge (app in sostituzione). */
export function firmaApp(dir: string): string | null {
  try {
    const file = path.join(dir, "package.json");
    return `${JSON.parse(fs.readFileSync(file, "utf8")).version}@${fs.statSync(file).mtimeMs}`;
  } catch { return null; }
}

/** Nuova versione = la firma di adesso è diversa da quella dell'avvio; se una delle due manca non si può dire. */
export const nuovaVersione = (avvio: string | null, adesso: string | null) => avvio !== null && adesso !== null && avvio !== adesso;

interface Mondo { dir: string; riapri(): void; silenzioso: boolean }

/** Il canale `impostazioni:aggiornamenti`. `false`: niente da fare (nessun chiamante lo usa più);
 *  `true`: controlla e dice se c'è una versione nuova; `"installa"`: riapre l'app, `false` se non l'ha riaperta. */
export function creaAggiornamenti({ dir, riapri, silenzioso }: Mondo) {
  const avvio = firmaApp(dir);
  return async (fai: unknown): Promise<boolean> => {
    if (fai === true) return nuovaVersione(avvio, firmaApp(dir));
    if (fai === "installa" && !silenzioso) { riapri(); return true; }
    return false;
  };
}
