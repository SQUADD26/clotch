// Il main chiede i lavori pesanti al worker (lavori-worker.ts) e aspetta la risposta: lettura e analisi dei file non fermano la finestra (#474).
import * as path from "node:path";
import { Worker } from "node:worker_threads";

let w: Worker | null = null, n = 0;
const attese = new Map<number, { ok: (v: any) => void; no: (e: Error) => void }>();

function avvia(): Worker {
  const x = new Worker(path.join(__dirname, "lavori-worker.js"));
  x.unref(); // non tiene viva l'app
  x.on("message", (m) => { const a = attese.get(m.n); attese.delete(m.n); if (m.errore) a?.no(new Error(m.errore)); else a?.ok(m.ok); });
  x.on("error", (e) => { for (const a of attese.values()) a.no(e); attese.clear(); w = null; }); // il prossimo lavoro riavvia il worker
  return x;
}

export function lavoro<T>(dati: Record<string, unknown>): Promise<T> {
  w ??= avvia();
  return new Promise<T>((ok, no) => { const i = ++n; attese.set(i, { ok, no }); w!.postMessage({ ...dati, n: i }); });
}

/** Chiude il worker (test; l'app esce senza). */
export const fermaLavori = () => { void w?.terminate(); w = null; };
