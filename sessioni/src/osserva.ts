// Aggiornamento dal vivo: fs.watch sulle cartelle, legge solo la coda nuova dei file JSONL.
import * as fs from "node:fs";
import * as path from "node:path";
import { leggiElenco } from "./elenco";
import { righeNuove, parseRiga } from "./jsonl";
import { nuovoConvertitore } from "./messaggi";
import { Aggiornamento, Elenco, Messaggio, Sessione } from "./tipi";

export class Osservatore {
  elenco: Elenco;
  private offset = new Map<string, number>();
  private conv = new Map<string, ReturnType<typeof nuovoConvertitore>>();
  private firme = new Map<string, string>(); // id -> JSON della sessione all'ultimo giro: si confronta, non si rifà ogni volta
  private watchers = new Map<string, fs.FSWatcher>();
  private avviato = false;
  private timer: NodeJS.Timeout | null = null;
  private dirty = new Set<string>();

  constructor(private home: string, private cb: (a: Aggiornamento) => void, private env: NodeJS.ProcessEnv = process.env, private attesaMs = 250, private imp?: () => Record<string, unknown> | undefined) {
    this.elenco = leggiElenco({ home, env, impostazioni: imp?.() });
    for (const s of this.elenco.sessioni) { this.firme.set(s.id, JSON.stringify(s)); if (s.file.endsWith(".jsonl")) this.offset.set(s.file, safeSize(s.file)); }
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
      ...radici.map((r) => path.join(h, r, "projects")),
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
        const w = fs.watch(d, { recursive: true }, (_ev, nome) => nome && this.tocca(path.join(d, String(nome))));
        w.on("error", () => {}); // cartella sparita o senza permesso: l'app non cade
        this.watchers.set(d, w);
      } catch { /* watch non disponibile su questa cartella */ }
    }
  }

  avvia() {
    this.avviato = true;
    this.guarda();
    // macOS (FSEvents) comincia a mandare eventi qualche istante dopo fs.watch: quello che si scrive prima non arriva.
    // Un giro subito raccoglie ciò che è cambiato dalla lettura iniziale; ogni giro poi raccoglie ogni file cresciuto (giro()).
    this.timer ??= setTimeout(() => { this.timer = null; this.giro(); }, this.attesaMs);
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

  /** Un giro: rilegge l'elenco (costa un stat per file), conta chi è cambiato, legge le code nuove. */
  giro() {
    const file = this.dirty;
    this.dirty = new Set();
    if (this.avviato) this.guarda();
    const prima = this.firme;
    this.elenco = leggiElenco({ home: this.home, env: this.env, impostazioni: this.imp?.() });
    this.firme = new Map(this.elenco.sessioni.map((s) => [s.id, JSON.stringify(s)]));
    // anche quelle sparite (spenta una sorgente, cartella esclusa): il renderer deve rileggere l'elenco
    const cambiate = [...this.firme.keys()].filter((id) => prima.get(id) !== this.firme.get(id)).concat([...prima.keys()].filter((id) => !this.firme.has(id)));
    // file cancellato per sempre: niente più offset né convertitore. Se c'è ancora (sorgente spenta) restano, per non rileggere tutto al ritorno
    const presenti = new Set(this.elenco.sessioni.map((s) => s.file));
    for (const f of this.offset.keys()) if (!presenti.has(f) && !fs.existsSync(f)) { this.offset.delete(f); this.conv.delete(f); }
    const nuovi: Aggiornamento["nuoviMessaggi"] = [];
    for (const s of this.elenco.sessioni) {
      // non solo i file dell'evento: un evento perso non deve perdere messaggi, basta che il file sia cresciuto
      if (!s.file.endsWith(".jsonl") || !(file.has(s.file) || safeSize(s.file) > (this.offset.get(s.file) ?? 0))) continue;
      const m = this.coda(s);
      if (m.length) nuovi.push({ id: s.id, messaggi: m });
    }
    if (cambiate.length || nuovi.length) this.cb({ sessioni: cambiate, nuoviMessaggi: nuovi });
  }

  private coda(s: Sessione): Messaggio[] {
    try {
      // file mai visto prima = sessione nata adesso: si parte dall'inizio
      const { righe, offset } = righeNuove(s.file, this.offset.get(s.file) ?? 0);
      this.offset.set(s.file, offset);
      const c = this.conv.get(s.file) ?? nuovoConvertitore(s);
      this.conv.set(s.file, c);
      return righe.flatMap((r) => {
        const o = parseRiga(r);
        if (!o) return [];
        const x = c.riga(o);
        return [...x.nuovi, ...x.aggiornati.filter((a) => !x.nuovi.includes(a))];
      });
    } catch {
      return []; // file sparito tra l'evento e la lettura
    }
  }
}

const safeSize = (f: string) => { try { return fs.statSync(f).size; } catch { return 0; } };
