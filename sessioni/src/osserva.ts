// Aggiornamento dal vivo: fs.watch sulle cartelle, legge solo la coda nuova dei file JSONL.
import * as fs from "node:fs";
import * as path from "node:path";
import { chiaveCartella, progettiDi, tocca } from "./claude-code";
import { leggiElenco } from "./elenco";
import { firmaFile } from "./messaggi";
import { Cronologia } from "./cronologia";
import { Aggiornamento, Elenco } from "./tipi";

/** Lo stato di partenza dell'osservatore: la lettura pesante (30 s con migliaia di trascrizioni). Gira anche in un worker (avvio-worker.ts, #463). */
export interface StatoIniziale { elenco: Elenco; firmeSessioni: Map<string, string>; firme: Map<string, string>; iniziali: Map<string, number> }
export function statoIniziale(home: string, env: NodeJS.ProcessEnv, impostazioni?: Record<string, unknown>): StatoIniziale {
  const elenco = leggiElenco({ home, env, impostazioni });
  const firmeSessioni = new Map(elenco.sessioni.map((s) => [s.id, JSON.stringify(s)]));
  const firme = new Map<string, string>(), iniziali = new Map<string, number>(); // iniziali: file -> dimensione all'avvio: l'ultima riga chiusa si cerca solo al primo evento, non per ogni sessione all'avvio
  for (const s of elenco.sessioni) if (s.file.endsWith(".jsonl")) {
    firme.set(s.file, firma(s.file));
    try { iniziali.set(s.file, fs.statSync(s.file).size); } catch { /* l'evento successivo riporterà l'errore */ }
  }
  return { elenco, firmeSessioni, firme, iniziali };
}

export class Osservatore {
  elenco: Elenco;
  private iniziali: Map<string, number>;
  private firme: Map<string, string>;
  private firmeSessioni: Map<string, string>; // id -> JSON della sessione all'ultimo giro: si confronta, non si rifà ogni volta
  private watchers = new Map<string, fs.FSWatcher>();
  private avviato = false;
  private timer: NodeJS.Timeout | null = null;
  private dirty = new Set<string>();
  private controllo = 0; // ultimo controllo di tutti i file (giro())

  /** `partenza`: lo stato già letto altrove (worker); senza, si legge qui. */
  constructor(private home: string, private cb: (a: Aggiornamento) => void, private env: NodeJS.ProcessEnv = process.env, private attesaMs = 250, private imp?: () => Record<string, unknown> | undefined, private cronologia = new Cronologia(), private partenza?: StatoIniziale) {
    const p = this.partenza ?? statoIniziale(home, env, imp?.());
    ({ elenco: this.elenco, firmeSessioni: this.firmeSessioni, firme: this.firme, iniziali: this.iniziali } = p);
    this.cronologia.collega((d) => this.cb({ sessioni: [d.sessione], cronologia: [d],
      nuoviMessaggi: d.tipo === "upsert" ? [{ id: d.sessione, messaggi: d.righe.map((r) => r.messaggio) }] : [] }));
  }

  /** Cartelle da guardare: non esistono ancora = si salta (si rivedono al prossimo avvio). */
  private cartelle(): string[] {
    const h = this.home;
    let radici: string[] = [];
    try { radici = fs.readdirSync(h).filter((n) => n === ".claude" || n.startsWith(".claude-")); } catch { /* home illeggibile */ }
    const support = path.join(h, "Library", "Application Support");
    let profili: string[] = [];
    try { profili = fs.readdirSync(support).filter((n) => /^[Cc]laude/.test(n)); } catch { /* niente app */ }
    return [
      ...new Map(radici.map((r) => progettiDi(path.join(h, r))).reverse().map((p) => [chiaveCartella(p), p])).values(), // una cartella vera, un osservatore (col nome del primo account)
      ...profili.map((p) => path.join(support, p, "claude-code-sessions")),
      path.join(h, ".claude", "obiettivi"), path.join(h, ".claude", "sessioni-stato"),
      path.join(h, ".codex", "sessions"), path.join(h, ".cursor", "projects"),
      ...(this.env.CODEX_HOME ? [path.join(this.env.CODEX_HOME, "sessions")] : []),
    ].filter((d) => fs.existsSync(d));
  }

  /** Guarda le cartelle che ci sono ora e lascia quelle sparite: un account aggiunto o tolto a app aperta ha il suo osservatore. */
  private guarda() {
    const ora = this.cartelle();
    for (const [d, w] of this.watchers) if (!ora.includes(d)) { w.close(); this.watchers.delete(d); }
    for (const d of ora) {
      if (this.watchers.has(d)) continue;
      try {
        const w = fs.watch(d, { recursive: true }, (_ev, nome) => this.tocca(nome ? path.join(d, String(nome)) : d));
        w.on("error", () => this.tocca(d)); // riconcilia i file noti senza creare polling
        this.watchers.set(d, w);
      } catch { /* watch non disponibile su questa cartella */ }
    }
  }

  avvia() {
    this.avviato = true;
    this.guarda();
    // macOS (FSEvents) comincia a mandare eventi qualche istante dopo fs.watch: quello che si scrive prima non arriva.
    // Un giro subito raccoglie ciò che è cambiato dalla lettura iniziale; poi ogni giro rilegge solo ciò che è cambiato (giro()).
    // shortcut: con lo stato letto da un worker niente giro subito (costa ~2,5 s di main con migliaia di sessioni): ciò che è cambiato nel frattempo si riconcilia al primo evento, quando si abbassa il costo del giro si rimette.
    if (!this.partenza) this.timer ??= setTimeout(() => { this.timer = null; this.giro(); }, this.attesaMs);
  }

  ferma() {
    this.avviato = false;
    this.watchers.forEach((w) => w.close());
    this.watchers.clear();
    if (this.timer) clearTimeout(this.timer);
  }

  tocca(file: string) {
    this.dirty.add(file);
    this.timer ??= setTimeout(() => { this.timer = null; this.giro(); }, this.attesaMs);
  }

  /** Un giro: rilegge l'elenco solo dove è cambiato qualcosa (evento o firma del file: rileggere tutto con migliaia di sessioni blocca il main per secondi, #474),
   * conta chi è cambiato, legge le code nuove. Un errore del watcher sporca la sua cartella intera: quel giro rilegge tutto lì. */
  giro() {
    const file = [...this.dirty];
    this.dirty.clear();
    if (this.avviato) this.guarda();
    // un evento perso non deve perdere messaggi: un file noto cambiato senza evento conta come evento (uno stat per file, niente readdir).
    // shortcut: il controllo di tutti i file gira al più ogni 5 s (con migliaia di sessioni costa decine di ms): un evento perso arriva entro il giro dopo i 5 s; se serve prima, abbassare CONTROLLO_MS.
    const attuali = new Map<string, string>();
    if (Date.now() - this.controllo >= CONTROLLO_MS) {
      this.controllo = Date.now();
      for (const [f, v] of this.firme) { const a = firma(f); attuali.set(f, a); if (a !== v) file.push(f); }
    }
    const prima = this.firmeSessioni;
    this.elenco = leggiElenco({ home: this.home, env: this.env, impostazioni: this.imp?.(), sporchi: file });
    this.firmeSessioni = new Map(this.elenco.sessioni.map((s) => [s.id, JSON.stringify(s)]));
    // anche quelle sparite (spenta una sorgente, cartella esclusa): il renderer deve rileggere l'elenco
    const cambiate = [...this.firmeSessioni.keys()].filter((id) => prima.get(id) !== this.firmeSessioni.get(id)).concat([...prima.keys()].filter((id) => !this.firmeSessioni.has(id)));
    for (const s of this.elenco.sessioni) {
      if (!s.file.endsWith(".jsonl")) continue;
      if (this.firme.has(s.file) && !file.some((f) => tocca(f, s.file))) continue;
      const attuale = attuali.get(s.file) ?? firma(s.file);
      this.cronologia.aggiorna(s, fineCompletaFinoA(s.file, this.iniziali.get(s.file) ?? 0));
      this.iniziali.delete(s.file);
      this.firme.set(s.file, attuale);
    }
    const presenti = new Set(this.elenco.sessioni.map((s) => s.file));
    for (const f of this.firme.keys()) if (!presenti.has(f)) { this.firme.delete(f); this.iniziali.delete(f); }
    if (cambiate.length) this.cb({ sessioni: cambiate, nuoviMessaggi: [] });
  }

}

const CONTROLLO_MS = 5000;

const firma = (file: string) => {
  try { return firmaFile(file); }
  catch { return "assente"; }
};

/** Ultima newline entro i primi `limite` byte: i byte già scritti all'avvio non cambiano, quindi vale come se fosse stata cercata allora. */
function fineCompletaFinoA(file: string, limite: number): number {
  if (!limite) return 0;
  try {
    const fd = fs.openSync(file, "r");
    try {
      for (let fine = limite; fine > 0;) {
        const inizio = Math.max(0, fine - 65536), b = Buffer.alloc(fine - inizio);
        const i = b.subarray(0, fs.readSync(fd, b, 0, b.length, inizio)).lastIndexOf(10);
        if (i >= 0) return inizio + i + 1;
        fine = inizio;
      }
      return 0;
    } finally { fs.closeSync(fd); }
  } catch { return 0; } // file sparito o illeggibile: l'evento riporterà l'errore
}
