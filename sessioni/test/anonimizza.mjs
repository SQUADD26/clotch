// Righe vere di una trascrizione -> fixture anonima: resta la forma (chiavi, tipi, nomi degli strumenti, testi fissi
// del sistema), sparisce il contenuto (testi, comandi, percorsi, id veri).
// Uso: node test/anonimizza.mjs <file.jsonl> <da>-<a>[,<da>-<a>...] > test/fixtures/situazioni/claude/<nome>.jsonl
import * as fs from "node:fs";
import * as crypto from "node:crypto";

const TIENI = new Set([
  "type", "subtype", "name", "level", "role", "stop_reason", "operation", "decision", "source", "reasonType", "toolDenialKind",
  "trigger", "error", "apiError", "model", "version", "entrypoint", "userType", "timestamp", "mode", "kind", "status", "phase",
  "codex_error_info", "reason", "permissionMode", "media", "media_reason", "code", "delivery", "namespace", "turn_trigger",
  "collaboration_mode_kind", "limit_id", "effort", "turnOrigin",
]);
const ID = /^(uuid|parentUuid|logicalParentUuid|sessionId|id|tool_use_id|agentId|promptId|requestId|call_id|turn_id|toolUseID|leafUuid|sourceToolAssistantUUID|agent_thread_id|headUuid|anchorUuid|tailUuid|messageId)$/;
// Testi scritti dal sistema, non da una persona: si tiene l'inizio, il resto diventa <testo>.
const FISSI = [
  "[Request interrupted by user for tool use]", "[Request interrupted by user]", "The user doesn't want to proceed with this tool use.",
  "User rejected tool use", "User has approved your plan.", "<tool_use_error>PreToolUse:", "PreToolUse:", "Error: Permission to use", "Permission to use", "No response after", "Async agent launched successfully", "You've hit your session limit", "API Error",
  "Conversation compacted", "No response requested.", "[Tool call interrupted", "<cross-session-message", "Claude AI usage limit reached",
  "Background (from the session that started this one)", "<side-sessions-event>", "Claude needs your permission",
];

const finto = (v) => v.replace(/[0-9a-f]/gi, (_, i) => crypto.createHash("sha1").update(v).digest("hex")[i % 40]);
function testo(v) {
  const f = FISSI.find((p) => v.startsWith(p));
  if (f) return v.length > f.length ? `${f} <testo>` : f;
  const dentro = FISSI.filter((p) => v.includes(p)); // es. un messaggio che comincia con un promemoria e poi ha <cross-session-message
  return dentro.length ? `<testo> ${dentro.join(" <testo> ")} <testo>` : "<testo>";
}
function pulisci(v, k) {
  if (Array.isArray(v)) return v.map((x) => pulisci(x, k));
  // una chiave che è un percorso (es. `changes` di Codex) diventa un percorso finto
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([kk, x], i) => [kk.includes("/") ? `/Users/x/app/file-${i}` : kk, pulisci(x, kk)]));
  if (typeof v !== "string") return v;
  if (k === "cwd") return "/Users/x/app";
  if (k === "gitBranch") return "feat/1-prova";
  if (k === "name") return /^[A-Za-z_][\w-]*$/.test(v) ? v : "<testo>"; // nome di strumento sì, nome di file no
  if (TIENI.has(k)) return v;
  if (ID.test(k)) return finto(v);
  return testo(v);
}

const [file, intervalli] = process.argv.slice(2);
const voglio = new Set(intervalli.split(",").flatMap((iv) => {
  const [da, a] = iv.split("-").map(Number);
  return Array.from({ length: (a || da) - da + 1 }, (_, j) => da + j);
}));
const ultima = Math.max(...voglio);
let i = 0;
// a righe, in streaming: un rollout Codex può superare la stringa più lunga di Node. Si divide solo su \n, come grep
// (readline divide anche su \r e sfasa i numeri di riga).
async function* righe() {
  let resto = "";
  for await (const pezzo of fs.createReadStream(file, "utf8")) {
    const parti = (resto + pezzo).split("\n");
    resto = parti.pop();
    yield* parti;
  }
  if (resto) yield resto;
}
for await (const riga of righe()) {
  if (++i > ultima) break;
  if (!voglio.has(i)) continue;
  try {
    console.log(JSON.stringify(pulisci(JSON.parse(riga))));
  } catch {
    console.log('{"type":"user","message":{"cont'); // riga rotta: resta rotta, senza il suo testo
  }
}
