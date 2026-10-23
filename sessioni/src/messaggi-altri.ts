// Codex e Cursor: righe JSONL -> messaggi. Stessa forma di Convertitore (messaggi-claude.ts).
import { Messaggio } from "./tipi";

type Strumento = Extract<Messaggio, { tipo: "strumento" }>;
type Esito = { nuovi: Messaggio[]; aggiornati: Strumento[] };
const t = (o: any): number | null => {
  const x = typeof o?.timestamp === "string" ? Date.parse(o.timestamp) : NaN;
  return Number.isNaN(x) ? null : x;
};
const unisci = (c: unknown, tipi: string[]) =>
  Array.isArray(c) ? c.map((b: any) => (tipi.includes(b?.type) && typeof b.text === "string" ? b.text : "")).join("") : String(c ?? "");

export class ConvertitoreCodex {
  private attesa = new Map<string, Strumento>();
  riga(o: any): Esito {
    const r: Esito = { nuovi: [], aggiornati: [] };
    if (o?.type !== "response_item" || !o.payload) return r;
    const p = o.payload;
    if (p.type === "message" && (p.role === "user" || p.role === "assistant")) {
      const testo = unisci(p.content, ["input_text", "output_text"]);
      if (testo.trim()) r.nuovi.push(p.role === "user" ? { tipo: "utente", testo, t: t(o) } : { tipo: "assistente", testo, modello: null, t: t(o) });
    } else if (p.type === "reasoning") {
      const testo = (Array.isArray(p.summary) ? p.summary : []).map((s: any) => s?.text ?? "").join("\n");
      if (testo.trim()) r.nuovi.push({ tipo: "pensiero", testo, t: t(o) });
    } else if (p.type === "function_call" || p.type === "custom_tool_call") {
      let ingresso: unknown = p.arguments ?? p.input;
      if (typeof ingresso === "string") try { ingresso = JSON.parse(ingresso); } catch { /* resta testo */ }
      const m: Strumento = { tipo: "strumento", id: String(p.call_id), nome: String(p.name), ingresso, esito: null, t: t(o) };
      this.attesa.set(m.id, m);
      r.nuovi.push(m);
    } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
      const m = this.attesa.get(String(p.call_id));
      if (m) {
        m.esito = { testo: typeof p.output === "string" ? p.output : JSON.stringify(p.output), errore: false };
        this.attesa.delete(m.id);
        r.aggiornati.push(m);
      }
    }
    return r;
  }
}

/** Cursor: righe `{role, message:{content}}` senza `type`; gli esiti degli strumenti non sono nel file. */
export class ConvertitoreCursor {
  riga(o: any): Esito {
    const r: Esito = { nuovi: [], aggiornati: [] };
    const c = o?.message?.content;
    if (o?.role === "user") {
      const testo = unisci(c, ["text"]).replace(/<\/?user_query>/g, "").trim();
      if (testo) r.nuovi.push({ tipo: "utente", testo, t: null });
    } else if (o?.role === "assistant") {
      const testo = unisci(c, ["text"]);
      if (testo.trim()) r.nuovi.push({ tipo: "assistente", testo, modello: null, t: null });
      for (const b of Array.isArray(c) ? c : []) {
        if (b?.type === "tool_use") r.nuovi.push({ tipo: "strumento", id: String(b.id ?? ""), nome: String(b.name), ingresso: b.input, esito: null, t: null });
      }
    }
    return r;
  }
}
