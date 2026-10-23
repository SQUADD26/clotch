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
  private chiamate = new Map<string, Strumento>();
  riga(o: any): Esito {
    const r: Esito = { nuovi: [], aggiornati: [] };
    if (o?.type === "event_msg" && o.payload?.type === "item_completed") return this.item(o.payload.item, t(o));
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
      this.chiamate.set(m.id, m);
      r.nuovi.push(m);
    } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
      const m = this.chiamate.get(String(p.call_id));
      if (m) {
        m.esito = { testo: typeof p.output === "string" ? p.output : JSON.stringify(p.output), errore: false };
        r.aggiornati.push(m);
      }
    }
    return r;
  }

  /** Azioni scritte come `item_completed`, nella forma degli strumenti Claude che la chat già disegna. */
  private item(i: any, quando: number | null): Esito {
    const r: Esito = { nuovi: [], aggiornati: [] };
    const nuovo = (id: string, nome: string, ingresso: unknown, testo: string, errore: boolean) => {
      const m: Strumento = { tipo: "strumento", id, nome, ingresso, esito: { testo, errore }, t: quando };
      r.nuovi.push(m);
    };
    const fallito = i?.status === "failed";
    if (i?.type === "CommandExecution") {
      const c = Array.isArray(i.command) ? i.command : [];
      const comando = c.length === 3 && /^-l?c$/.test(c[1]) ? String(c[2]) : c.join(" ");
      nuovo(String(i.id), "Bash", { command: comando }, String(i.aggregated_output ?? i.formatted_output ?? i.stdout ?? ""), fallito);
    } else if (i?.type === "McpToolCall") {
      const testo = (i.result?.content ?? []).map((b: any) => (typeof b?.text === "string" ? b.text : "")).join("") || JSON.stringify(i.error ?? "");
      const m = this.chiamate.get(String(i.id)); // stessa chiamata già letta come response_item: niente doppione, ma lo stato è quello vero
      if (m) { m.esito = { testo, errore: fallito || i.result?.isError === true }; r.aggiornati.push(m); }
      else nuovo(String(i.id), `mcp__${i.server}__${i.tool}`, i.arguments, testo, fallito || i.result?.isError === true);
    } else if (i?.type === "FileChange") {
      Object.entries(i.changes ?? {}).forEach(([file, ch]: [string, any], n) => {
        const id = `${i.id}:${n}`, testo = String(i.stdout ?? "");
        if (ch?.type === "add") nuovo(id, "Write", { file_path: file, content: ch.content }, testo, fallito);
        else if (ch?.type === "delete") nuovo(id, "Edit", { file_path: file, old_string: ch.content, new_string: "" }, testo, fallito);
        else nuovo(id, "MultiEdit", { file_path: file, edits: modifiche(String(ch?.unified_diff ?? "")) }, testo, fallito);
      });
    } else if (i?.type === "Extension" && i.kind === "web.search") {
      const fonti = (i.results ?? []).map((x: any) => ({ title: x?.title, url: x?.url }));
      nuovo(String(i.id), "WebSearch", { query: i.query }, `Links: ${JSON.stringify(fonti)}`, false);
    } else if (i?.type === "SubAgentActivity" && (i.kind === "started" || i.kind === "completed")) {
      const id = `agente:${i.agent_thread_id}`, m = this.chiamate.get(id), descrizione = { description: String(i.agent_path ?? "").split("/").pop() };
      const spawn = this.chiamate.get(String(i.id)); // il function_call spawn_agent già letto ha l'id dell'item: diventa lui l'aiutante, una sola riga
      if (i.kind === "started" && spawn) {
        Object.assign(spawn, { nome: "Agent", ingresso: descrizione });
        this.chiamate.set(id, spawn);
        r.aggiornati.push(spawn);
      } else if (i.kind === "started") {
        const a: Strumento = { tipo: "strumento", id, nome: "Agent", ingresso: descrizione, esito: null, t: quando };
        this.chiamate.set(id, a);
        r.nuovi.push(a);
      } else if (m) { m.esito = { testo: "Completato", errore: false }; r.aggiornati.push(m); }
      else nuovo(id, "Agent", descrizione, "Completato", false);
    }
    return r;
  }
}

/** Un `unified_diff` di Codex -> coppie vecchio/nuovo, una per blocco `@@` (le righe di contesto stanno in entrambe). */
function modifiche(diff: string) {
  const out: { old_string: string; new_string: string }[] = [];
  let v: string[] = [], n: string[] = [], aperto = false;
  const chiudi = () => { if (aperto) out.push({ old_string: v.join("\n"), new_string: n.join("\n") }); v = []; n = []; };
  for (const l of diff.replace(/\n$/, "").split("\n")) {
    if (l.startsWith("@@")) { chiudi(); aperto = true; }
    else if (!aperto || l.startsWith("\\")) continue;
    else if (l.startsWith("-")) v.push(l.slice(1));
    else if (l.startsWith("+")) n.push(l.slice(1));
    else { v.push(l.slice(1)); n.push(l.slice(1)); }
  }
  chiudi();
  return out;
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
