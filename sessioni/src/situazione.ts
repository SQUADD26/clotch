// Situazione di una sessione letta dalla coda della trascrizione (righe JSONL già parse).
// Forme verificate sui file veri del Mac: catalogo in test/situazioni.md, fixture in test/fixtures/situazioni/.

export type Adesso = "lavora" | "domanda" | "piano" | "aiutanti" | "turno_finito" | "interrotta" | "errore" | "limite" | "riprova" | "sconosciuta";
export type Segno =
  | "rifiutata_da_te" | "negata_da_regola" | "bloccata_da_hook" | "permesso_dato" | "domanda_scaduta" | "piano_approvato"
  | "aiutanti" | "modifica" | "ricerca_web" | "compattazione" | "interrotta" | "messaggio_sessione" | "figlia" | "comando_fallito" | "limite";

export interface Situazione {
  adesso: Adesso;
  /** Strumento chiamato e ancora senza esito (permesso, domanda, piano o lavoro in corso). */
  strumento: string | null;
  inCoda: number;
  /** Cose successe nella parte letta, in ordine di prima apparizione. */
  segni: Segno[];
}

const ATTESA: Record<string, Adesso> = { AskUserQuestion: "domanda", ExitPlanMode: "piano", Agent: "aiutanti", request_user_input_async: "domanda" };
const MODIFICA = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const FIGLIA = "Background (from the session that started this one)";

const testi = (c: unknown): string =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((b: any) => (typeof b?.text === "string" ? b.text : typeof b?.content === "string" ? b.content : "")).join("\n") : "";

function fine(adesso: Adesso, attesa: Map<string, string>, inCoda: number, segni: Set<Segno>): Situazione {
  const ultimo = [...attesa.values()].pop() ?? null;
  return { adesso: ultimo ? ATTESA[ultimo] ?? "lavora" : adesso, strumento: ultimo, inCoda: Math.max(0, inCoda), segni: [...segni] };
}

export function situazioneClaude(righe: any[]): Situazione {
  let adesso: Adesso = "sconosciuta", inCoda = 0;
  const attesa = new Map<string, string>(), segni = new Set<Segno>();
  for (const o of righe) {
    if (!o || typeof o !== "object") continue;
    if (o.type === "queue-operation") {
      inCoda += o.operation === "enqueue" ? 1 : o.operation === "dequeue" || o.operation === "remove" ? -1 : 0;
      if (o.operation === "enqueue" && String(o.content ?? "").includes(FIGLIA)) segni.add("figlia");
      continue;
    }
    if (o.type === "system") {
      if (o.subtype === "compact_boundary") segni.add("compattazione");
      else if (o.subtype === "api_error") adesso = "riprova";
      else if (o.subtype === "stop_hook_summary" && adesso !== "interrotta") adesso = "turno_finito";
      continue;
    }
    if (o.type !== "user" && o.type !== "assistant") continue;
    const c = o.message?.content, testo = testi(c);
    if (o.isCompactSummary) segni.add("compattazione");
    if (o.turnOrigin === "peer" || testo.includes("<cross-session-message")) segni.add("messaggio_sessione");
    if (testo.includes(FIGLIA)) segni.add("figlia");
    if (o.type === "assistant") {
      if (o.isApiErrorMessage) { adesso = o.error === "rate_limit" ? "limite" : "errore"; continue; } // limite: «You've hit your session limit · resets …»
      for (const b of Array.isArray(c) ? c : []) {
        if (b?.type !== "tool_use") continue;
        attesa.set(String(b.id), String(b.name));
        if (b.name === "Agent") segni.add("aiutanti");
        if (MODIFICA.has(b.name)) segni.add("modifica");
        if (b.name === "WebSearch" || b.name === "WebFetch") segni.add("ricerca_web");
        adesso = "lavora";
      }
      // «No response requested.» è la risposta automatica dopo un'interruzione: non chiude il turno
      if (o.message?.stop_reason !== "tool_use" && testo.trim() && testo.trim() !== "No response requested.") adesso = "turno_finito";
      continue;
    }
    // riga user: risposta di uno strumento, interruzione o nuovo messaggio
    const risultati = Array.isArray(c) ? c.filter((b: any) => b?.type === "tool_result") : [];
    for (const b of risultati) {
      const nome = attesa.get(String(b.tool_use_id));
      attesa.delete(String(b.tool_use_id));
      const r = testi(b.content);
      if (nome === "AskUserQuestion" && r.startsWith("No response after")) segni.add("domanda_scaduta");
      if (nome === "ExitPlanMode" && !b.is_error) segni.add("piano_approvato");
    }
    const k = o.toolDenialKind, dec = o.permissionDecision;
    if (k === "user-rejected") segni.add("rifiutata_da_te");
    else if (k === "interrupted") segni.add("interrotta");
    else if (k === "permission-rule") segni.add(dec?.source === "hook" || /PreToolUse:|hook error/.test(testi(risultati[0]?.content)) ? "bloccata_da_hook" : "negata_da_regola");
    if (dec?.source === "user_temporary" || dec?.source === "user_permanent") segni.add("permesso_dato");
    if (o.toolUseResult?.structuredPatch) segni.add("modifica");
    if (k === "interrupted" || testo.startsWith("[Request interrupted by user")) { segni.add("interrotta"); adesso = "interrotta"; attesa.clear(); }
    else if (risultati.length || (testo.trim() && !o.isMeta)) adesso = "lavora";
  }
  return fine(adesso, attesa, inCoda, segni);
}

export function situazioneCodex(righe: any[]): Situazione {
  let adesso: Adesso = "sconosciuta";
  const attesa = new Map<string, string>(), segni = new Set<Segno>();
  for (const o of righe) {
    const p = o?.payload ?? {};
    if (o?.type === "compacted") { segni.add("compattazione"); continue; }
    if (o?.type === "response_item") {
      if (p.type === "function_call" || p.type === "custom_tool_call") {
        attesa.set(String(p.call_id), String(p.name));
        if (p.name === "spawn_agent") segni.add("aiutanti");
      } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") attesa.delete(String(p.call_id));
      continue;
    }
    if (o?.type !== "event_msg") continue;
    if (p.type === "task_started") adesso = "lavora";
    else if (p.type === "turn_aborted") { adesso = "interrotta"; segni.add("interrotta"); attesa.clear(); }
    else if (p.type === "task_complete") {
      adesso = p.error ? (p.error.codex_error_info === "usage_limit_exceeded" ? "limite" : "errore") : "turno_finito";
      attesa.clear();
    } else if (p.type === "token_count" && (p.rate_limits?.primary?.used_percent ?? 0) >= 100) segni.add("limite");
    else if (p.type === "item_completed") {
      const it = p.item ?? {};
      if (it.type === "FileChange") segni.add("modifica");
      else if (it.type === "SubAgentActivity" || it.type === "CollabAgentToolCall") segni.add("aiutanti");
      else if (it.type === "ContextCompaction") segni.add("compattazione");
      else if (it.type === "Extension" && it.kind === "web.search") segni.add("ricerca_web");
      else if ((it.type === "CommandExecution" || it.type === "McpToolCall") && it.status === "failed") segni.add("comando_fallito");
    }
  }
  return fine(adesso, attesa, 0, segni);
}
