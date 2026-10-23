// L'API vera, nel processo main: elenco, messaggi a pagine, evento di aggiornamento.
import * as os from "node:os";
import { leggiElenco } from "./elenco";
import { leggiPagina } from "./messaggi";
import { Osservatore } from "./osserva";
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
}
