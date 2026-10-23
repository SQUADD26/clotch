// Aggiornamento dal vivo: fs.watch sulle cartelle, legge solo la coda nuova dei file JSONL.
import * as fs from "node:fs";
import * as path from "node:path";
import { leggiElenco } from "./elenco";
import { fineCompleta, firmaFile } from "./messaggi";
import { Cronologia } from "./cronologia";
import { Aggiornamento, Elenco } from "./tipi";

export class Osservatore {
  elenco: Elenco;
  private iniziali = new Map<string, number>();
  private firme = new Map<string, string>();
  private watchers: fs.FSWatcher[] = [];
  private timer: NodeJS.Timeout | null = null;
  private dirty = new Set<string>();

  constructor(private home: string, private cb: (a: Aggiornamento) => void, private env: NodeJS.ProcessEnv = process.env, private attesaMs = 250, private imp?: () => Record<string, unknown> | undefined, private cronologia = new Cronologia()) {
    this.elenco = leggiElenco({ home, env, impostazioni: imp?.() });
    for (const s of this.elenco.sessioni) if (s.file.endsWith(".jsonl")) {
      this.firme.set(s.file, firma(s.file));
      try { this.iniziali.set(s.file, fineCompleta(s.file)); } catch { /* l'evento successivo riporterà l'errore */ }
    }
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
      ...radici.map((r) => path.join(h, r, "projects")),
      ...profili.map((p) => path.join(support, p, "claude-code-sessions")),
      path.join(h, ".claude", "obiettivi"), path.join(h, ".claude", "sessioni-stato"),
      path.join(h, ".codex", "sessions"), path.join(h, ".cursor", "projects"),
      ...(this.env.CODEX_HOME ? [path.join(this.env.CODEX_HOME, "sessions")] : []),
    ].filter((d) => fs.existsSync(d));
  }

  avvia() {
    for (const d of this.cartelle()) {
      try {
        const w = fs.watch(d, { recursive: true }, (_ev, nome) => this.tocca(nome ? path.join(d, String(nome)) : d));
        w.on("error", () => this.tocca(d)); // riconcilia i file noti senza creare polling
        this.watchers.push(w);
      } catch { /* watch non disponibile su questa cartella */ }
    }
    // macOS (FSEvents) comincia a mandare eventi qualche istante dopo fs.watch: quello che si scrive prima non arriva.
    // Un giro subito raccoglie ciò che è cambiato dalla lettura iniziale; ogni giro poi raccoglie ogni file cresciuto (giro()).
    this.timer ??= setTimeout(() => { this.timer = null; this.giro(); }, this.attesaMs);
  }

  ferma() {
    this.watchers.forEach((w) => w.close());
    this.watchers = [];
    if (this.timer) clearTimeout(this.timer);
  }

  tocca(file: string) {
    this.dirty.add(file);
    this.timer ??= setTimeout(() => { this.timer = null; this.giro(); }, this.attesaMs);
  }

  /** Un giro: rilegge l'elenco (costa un stat per file), conta chi è cambiato, legge le code nuove. */
  giro() {
    const file = [...this.dirty];
    this.dirty.clear();
    const prima = new Map(this.elenco.sessioni.map((s) => [s.id, JSON.stringify(s)]));
    this.elenco = leggiElenco({ home: this.home, env: this.env, impostazioni: this.imp?.() });
    const dopo = new Set(this.elenco.sessioni.map((s) => s.id));
    // anche quelle sparite (spenta una sorgente, cartella esclusa): il renderer deve rileggere l'elenco
    const cambiate = [...this.elenco.sessioni.filter((s) => prima.get(s.id) !== JSON.stringify(s)).map((s) => s.id), ...[...prima.keys()].filter((id) => !dopo.has(id))];
    for (const s of this.elenco.sessioni) {
      if (!s.file.endsWith(".jsonl")) continue;
      const attuale = firma(s.file);
      // La riconciliazione parte solo da avvio/evento; include rename, riscritture e crescita senza evento nominato.
      if (attuale === this.firme.get(s.file) && !file.some((f) => s.file === f || s.file.startsWith(`${f}${path.sep}`))) continue;
      this.cronologia.aggiorna(s, this.iniziali.get(s.file) ?? 0);
      this.iniziali.delete(s.file);
      this.firme.set(s.file, attuale);
    }
    const presenti = new Set(this.elenco.sessioni.map((s) => s.file));
    for (const f of this.firme.keys()) if (!presenti.has(f)) { this.firme.delete(f); this.iniziali.delete(f); }
    if (cambiate.length) this.cb({ sessioni: cambiate, nuoviMessaggi: [] });
  }

}

const firma = (file: string) => {
  try { return firmaFile(file); }
  catch { return "assente"; }
};
