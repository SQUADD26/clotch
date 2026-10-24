// Il main chiede i lavori pesanti al worker (lavori-worker.ts) e aspetta la risposta: lettura e analisi dei file non fermano la finestra (#474).
import * as path from "node:path";
import { Worker } from "node:worker_threads";

let w: Worker | null = null, n = 0;
const attese = new Map<number, { x: Worker; ok: (v: any) => void; no: (e: Error) => void }>();

function avvia(): Worker {
  const x = new Worker(path.join(__dirname, "lavori-worker.js"));
  x.unref(); // non tiene viva l'app
  x.on("message", (m) => { const a = attese.get(m.n); attese.delete(m.n); if (m.errore) a?.no(new Error(m.errore)); else a?.ok(m.ok); });
  // errore o uscita (anche senza errore): le richieste di questo worker falliscono, non restano appese; il prossimo lavoro ne avvia un altro
  const cade = (e: Error) => { for (const [i, a] of attese) if (a.x === x) { attese.delete(i); a.no(e); } if (w === x) w = null; };
  x.on("error", cade);
  x.on("exit", (c) => cade(new Error(`worker dei lavori uscito (${c})`)));
  return x;
}

export function lavoro<T>(dati: Record<string, unknown>): Promise<T> {
  return new Promise<T>((ok, no) => { const x = (w ??= avvia()), i = ++n; attese.set(i, { x, ok, no }); x.postMessage({ ...dati, n: i }); });
}

/** Chiude il worker (test; l'app esce senza). */
export const fermaLavori = () => { void w?.terminate(); w = null; };
