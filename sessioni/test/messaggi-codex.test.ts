import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { ConvertitoreCodex } from "../src/messaggi-altri";
import { Messaggio } from "../src/tipi";

const DIR = path.join(__dirname, "..", "..", "test", "fixtures", "situazioni", "codex");
const strumenti = (ms: Messaggio[]) => ms.flatMap((m) => (m.tipo === "strumento" ? [m] : []));
const converti = (righe: unknown[]) => {
  const c = new ConvertitoreCodex();
  return righe.flatMap((o) => c.riga(o).nuovi);
};
const fixture = (nome: string) =>
  converti(fs.readFileSync(path.join(DIR, nome + ".jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const item = (i: object) => ({ timestamp: "2026-10-08T07:30:00.000Z", type: "event_msg", payload: { type: "item_completed", item: i } });

test("comando fallito (fixture): strumento Bash con esito in errore", () => {
  const s = strumenti(fixture("comando-fallito"));
  assert.equal(s.length, 1);
  assert.equal(s[0].nome, "Bash");
  assert.equal(s[0].esito?.errore, true);
});

test("comando riuscito: comando senza la shell e uscita come esito", () => {
  const [m] = strumenti(converti([item({ type: "CommandExecution", id: "c1", command: ["/bin/zsh", "-lc", "ls -la"], status: "completed", aggregated_output: "ok", exit_code: 0 })]));
  assert.deepEqual([m.nome, m.ingresso, m.esito], ["Bash", { command: "ls -la" }, { testo: "ok", errore: false }]);
});

test("modifica (fixture): file nuovo come Write", () => {
  const s = strumenti(fixture("modifica-con-differenze"));
  assert.deepEqual(s.map((m) => m.nome), ["Write"]);
  assert.equal(s[0].esito?.errore, false);
});

test("modifica con differenze: un blocco @@ per coppia vecchio/nuovo, contesto in entrambe", () => {
  const diff = "@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n@@ -9,2 +9,3 @@\n x\n+y\n z\n";
  const [m] = strumenti(converti([item({ type: "FileChange", id: "f1", status: "completed", changes: { "/x/a.ts": { type: "update", unified_diff: diff } } })]));
  assert.equal(m.nome, "MultiEdit");
  assert.deepEqual(m.ingresso, { file_path: "/x/a.ts", edits: [{ old_string: "a\nb\nc", new_string: "a\nB\nc" }, { old_string: "x\nz", new_string: "x\ny\nz" }] });
});

test("ricerca web (fixture): WebSearch con le fonti nel formato Claude", () => {
  const [m] = strumenti(fixture("ricerca-web"));
  assert.equal(m.nome, "WebSearch");
  assert.match(m.esito!.testo, /^Links: \[/);
});

test("aiutante (fixture): Agent aperto, chiuso dal completed dello stesso thread", () => {
  assert.ok(strumenti(fixture("aiutanti")).some((m) => m.nome === "Agent" && m.esito === null));
  const c = new ConvertitoreCodex();
  const sub = (kind: string) => item({ type: "SubAgentActivity", id: "k-" + kind, kind, agent_thread_id: "T", agent_path: "/root/lavoro" });
  const a = c.riga(sub("started")).nuovi[0] as Extract<Messaggio, { tipo: "strumento" }>;
  assert.equal(a.esito, null);
  assert.deepEqual(c.riga(sub("completed")).aggiornati, [a]);
  assert.equal((a.esito as { errore: boolean } | null)?.errore, false);
});

test("nessun doppione: la stessa chiamata MCP come response_item e come item_completed esce una volta, con lo stato vero", () => {
  const c = new ConvertitoreCodex();
  const chiamata = { type: "response_item", payload: { type: "function_call", name: "js", call_id: "call_1", arguments: "{}" } };
  const uscita = { type: "response_item", payload: { type: "function_call_output", call_id: "call_1", output: "boom" } };
  const nuovi = [chiamata, uscita, item({ type: "McpToolCall", id: "call_1", server: "s", tool: "js", status: "failed", result: { content: [{ type: "text", text: "boom" }], isError: true } })]
    .flatMap((o) => c.riga(o).nuovi);
  assert.equal(strumenti(nuovi).length, 1);
  assert.equal(strumenti(nuovi)[0].esito?.errore, true);
});
