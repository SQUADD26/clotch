// Worker d'avvio (#463): la prima lettura di tutte le sessioni (30 s sul Mac con migliaia di trascrizioni) fuori dal main.
// Risponde con lo stato dell'osservatore e le cache già riempite; il main le copia (api.ts).
// Cache d'avvio (#474): le cache per file e l'elenco restano su disco, così l'avvio dopo controlla solo i file (stat) e la finestra mostra subito l'elenco di prima.
import * as fs from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { caricaCache, copiaCache } from "./altre-sorgenti";
import { cache } from "./claude-code";
import { leggiElenco } from "./elenco";
import { statoIniziale } from "./osserva";

/** Sale quando cambia la forma di `Sessione` o un lettore: una cache vecchia si butta e si rilegge tutto. */
const VERSIONE_CACHE = 1;

const file: string | undefined = workerData.cache;
let conCache = false;
if (file) {
  try {
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    if (c?.v === VERSIONE_CACHE) { for (const [k, v] of c.claude) cache.set(k, v); caricaCache(c.altre); conCache = true; }
  } catch { /* prima volta o file rotto: si legge tutto */ }
}
// senza cache (primo avvio): prima le sessioni delle ultime 24 ore, subito alla finestra; poi tutte
if (!conCache) parentPort?.postMessage({ anteprima: leggiElenco({ home: workerData.home, env: workerData.env, impostazioni: workerData.imp, soloDopo: Date.now() - 86_400_000 }) });
const stato = statoIniziale(workerData.home, workerData.env, workerData.imp);
const claude = [...cache], altre = copiaCache();
parentPort?.postMessage({ stato, claude, altre });
if (file) {
  try {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ v: VERSIONE_CACHE, claude, altre, elenco: stato.elenco }));
    fs.renameSync(`${file}.tmp`, file);
  } catch { /* disco pieno o cartella sparita: al prossimo avvio si rilegge */ }
}
