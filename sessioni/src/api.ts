// L'API vera, nel processo main: elenco, messaggi a pagine, evento di aggiornamento.
import * as os from "node:os";
import { leggiElenco } from "./elenco";
import { leggiPagina } from "./messaggi";
import { Osservatore } from "./osserva";
import { Aggiornamento, Elenco, PaginaMessaggi } from "./tipi";

export class Sessioni {
  private oss: Osservatore | null = null;
  constructor(private home = os.homedir()) {}

  elencoSessioni(): Elenco {
    return this.oss ? this.oss.elenco : leggiElenco({ home: this.home });
  }

  messaggi(id: string, pagina: number): PaginaMessaggi {
    const s = this.elencoSessioni().sessioni.find((x) => x.id === id);
    return s ? leggiPagina(s, pagina) : { messaggi: [], pagina, haAltre: false, errore: "sessione non trovata", totale: null };
  }

  osserva(cb: (a: Aggiornamento) => void) {
    this.oss ??= new Osservatore(this.home, cb);
    this.oss.avvia();
  }
}
