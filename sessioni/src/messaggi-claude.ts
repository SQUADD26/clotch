// Trascrizione Claude Code (righe JSONL) -> messaggi. Formato verificato su ~/.claude/projects.
import { Messaggio } from "./tipi";

type Strumento = Extract<Messaggio, { tipo: "strumento" }>;

const tempo = (o: any): number | null => {
  const t = typeof o?.timestamp === "string" ? Date.parse(o.timestamp) : NaN;
  return Number.isNaN(t) ? null : t;
};

const testoDi = (c: unknown): string => {
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.map((b: any) => (b?.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
};

/** Tiene in memoria solo le chiamate senza esito, per agganciare il tool_result che arriva dopo. */
export class Convertitore {
  private attesa = new Map<string, Strumento>();

  /** `nuovi`: messaggi nati da questa riga. `aggiornati`: chiamate che ora hanno l'esito. */
  riga(o: any): { nuovi: Messaggio[]; aggiornati: Strumento[] } {
    const nuovi: Messaggio[] = [];
    const aggiornati: Strumento[] = [];
    if (!o || typeof o !== "object" || o.isMeta) return { nuovi, aggiornati };
    const t = tempo(o);

    if (o.type === "system" && o.level === "error") {
      nuovi.push({ tipo: "errore", testo: String(o.content ?? ""), t });
    } else if (o.type === "user" || o.type === "assistant") {
      const c = o.message?.content;
      if (o.type === "assistant" && o.isApiErrorMessage) {
        nuovi.push({ tipo: "errore", testo: testoDi(c), t });
      } else if (typeof c === "string") {
        if (c.trim()) nuovi.push(o.type === "user" ? { tipo: "utente", testo: c, t } : { tipo: "assistente", testo: c, modello: o.message?.model ?? null, t });
      } else if (Array.isArray(c)) {
        for (const b of c) {
          if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
            nuovi.push(o.type === "user" ? { tipo: "utente", testo: b.text, t } : { tipo: "assistente", testo: b.text, modello: o.message?.model ?? null, t });
          } else if (b?.type === "thinking" && typeof b.thinking === "string" && b.thinking.trim()) {
            nuovi.push({ tipo: "pensiero", testo: b.thinking, t });
          } else if (b?.type === "tool_use") {
            const m: Strumento = { tipo: "strumento", id: String(b.id), nome: String(b.name), ingresso: b.input, esito: null, t };
            this.attesa.set(m.id, m);
            nuovi.push(m);
          } else if (b?.type === "tool_result") {
            const m = this.attesa.get(String(b.tool_use_id));
            if (m) {
              m.esito = { testo: testoDi(b.content), errore: b.is_error === true };
              this.attesa.delete(m.id);
              aggiornati.push(m);
            }
          }
        }
      }
    }
    return { nuovi, aggiornati };
  }
}
