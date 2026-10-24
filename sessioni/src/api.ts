// L'API vera, nel processo main: elenco, messaggi a pagine, evento di aggiornamento.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Worker } from "node:worker_threads";
import { caricaCache } from "./altre-sorgenti";
import { cache as cacheClaude } from "./claude-code";
import { leggiElenco } from "./elenco";
import { leggiPagina } from "./messaggi";
import { Osservatore, type StatoIniziale } from "./osserva";
import { Cronologia } from "./cronologia";
import type { OpzioniCronologia } from "./cronologia-tipi";
import { Aggiornamento, Elenco, PaginaMessaggi } from "./tipi";

export class Sessioni {
  private oss: Osservatore | null = null;
  private cronologia = new Cronologia();
  /** Impostazioni salvate che filtrano l'elenco (#404); finché non arrivano, niente filtro. */
  private imp: Record<string, unknown> | undefined;
  constructor(private home = os.homedir()) {}

  elencoSessioni(): Elenco {
    return this.oss ? this.oss.elenco : leggiElenco({ home: this.home, impostazioni: this.imp });
  }

  /** Nuove impostazioni salvate: l'elenco si rifà subito e chi ascolta riceve le sessioni apparse o sparite. */
  impostazioni(i: Record<string, unknown>) {
    this.imp = i;
    this.oss?.giro();
  }

  messaggi(id: string, pagina: number, opzioni?: OpzioniCronologia): PaginaMessaggi {
    const s = this.elencoSessioni().sessioni.find((x) => x.id === id);
    if (s) return opzioni ? this.cronologia.pagina(s, pagina, opzioni) : leggiPagina(s, pagina);
    return { messaggi: [], pagina, haAltre: false, errore: "sessione non trovata", totale: null,
      ...(opzioni ? { erroreCronologia: { codice: "sorgente_assente" as const, testo: "sessione non trovata", ripartenza: "nuova_snapshot" as const } } : {}) };
  }

  osserva(cb: (a: Aggiornamento) => void) {
    this.oss ??= new Osservatore(this.home, cb, process.env, 250, () => this.imp, this.cronologia);
    this.oss.avvia();
  }

  /** L'elenco salvato dal worker all'avvio di prima (avvio-worker.ts): da mostrare finché quello vero non è letto. null se manca o è rotto. */
  elencoInCache(fileCache: string): Elenco | null {
    try { const e = JSON.parse(fs.readFileSync(fileCache, "utf8")).elenco; return e && Array.isArray(e.sessioni) ? e : null; } catch { return null; }
  }

  /** Come osserva(), ma la prima lettura (lenta) gira in un worker: il main resta libero. Se il worker fallisce si legge nel main, come prima. */
  async osservaInWorker(cb: (a: Aggiornamento) => void, fileCache?: string) {
    const imp = this.imp;
    try {
      const r = await new Promise<{ stato: StatoIniziale; claude: [string, any][]; altre: Parameters<typeof caricaCache>[0] }>((ok, no) => {
        const w = new Worker(path.join(__dirname, "avvio-worker.js"), { workerData: { home: this.home, env: { ...process.env }, imp, cache: fileCache } });
        w.once("message", ok); w.once("error", no);
        w.once("exit", (c) => no(new Error(`worker d'avvio uscito (${c})`)));
      });
      for (const [k, v] of r.claude) cacheClaude.set(k, v);
      caricaCache(r.altre);
      this.oss ??= new Osservatore(this.home, cb, process.env, 250, () => this.imp, this.cronologia, r.stato);
      this.oss.avvia();
      if (this.imp !== imp) this.oss.giro(); // impostazioni cambiate mentre il worker leggeva
    } catch { this.osserva(cb); }
  }
}
