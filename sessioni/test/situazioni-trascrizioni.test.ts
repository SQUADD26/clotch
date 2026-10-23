// Situazioni riconosciute dalla lettura dati (#334) su righe vere anonimizzate (test/anonimizza.mjs). Catalogo: test/situazioni.md.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiElenco } from "../src/elenco";
import { Adesso, Segno } from "../src/situazione";
import { Sessione } from "../src/tipi";

const FIX = path.join(__dirname, "..", "..", "test", "fixtures", "situazioni");
const ORA = Date.parse("2026-10-24T00:00:00Z");

/** Ogni fixture va in una home vuota, nel posto dove la sorgente la scrive, e passa da leggiElenco. */
function leggi(sorgente: "claude" | "codex", nome: string, coda = ""): Sessione {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "situazione-"));
  const id = "0000aaaa-0000-4000-8000-000000000001";
  const dir = sorgente === "claude" ? path.join(home, ".claude", "projects", "-Users-x-app") : path.join(home, ".codex", "sessions", "2026", "10", "01");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, sorgente === "claude" ? `${id}.jsonl` : `rollout-2026-10-01T10-00-00-${id}.jsonl`);
  fs.writeFileSync(file, fs.readFileSync(path.join(FIX, sorgente, `${nome}.jsonl`), "utf8") + coda);
  const e = leggiElenco({ home, env: {}, ora: ORA });
  assert.deepEqual(e.errori, []);
  assert.equal(e.sessioni.length, 1, "la fixture deve essere una sessione");
  return e.sessioni[0];
}

type Atteso = { adesso?: Adesso; strumento?: string; segni?: Segno[]; inCoda?: number };
const CLAUDE: [string, Atteso][] = [
  ["al-lavoro", { adesso: "lavora", strumento: "Bash" }],
  ["domanda-aperta", { adesso: "domanda", strumento: "AskUserQuestion" }],
  ["domanda-scaduta", { segni: ["domanda_scaduta"] }],
  ["piano-aperto", { adesso: "piano", strumento: "ExitPlanMode" }],
  ["piano-approvato", { adesso: "lavora", segni: ["piano_approvato"] }],
  ["aiutante-al-lavoro", { adesso: "aiutanti", strumento: "Agent", segni: ["aiutanti"] }],
  ["aiutante-in-background", { adesso: "lavora", segni: ["aiutanti"] }],
  ["modifica-con-differenze", { segni: ["modifica"] }],
  ["ricerca-web", { segni: ["ricerca_web"] }],
  ["messaggio-in-coda", { inCoda: 1 }],
  ["coda-consumata", { inCoda: 0 }],
  ["rifiutata-da-te", { adesso: "interrotta", segni: ["rifiutata_da_te", "interrotta"] }],
  ["interrotta-a-meta-strumento", { adesso: "interrotta", segni: ["interrotta"] }],
  ["turno-finito", { adesso: "turno_finito" }],
  ["bloccata-da-hook", { segni: ["bloccata_da_hook"] }],
  ["bloccata-da-hook-mcp", { segni: ["bloccata_da_hook"] }],
  ["negata-da-regola", { segni: ["negata_da_regola"] }],
  ["permesso-dato-a-mano", { segni: ["permesso_dato"] }],
  ["errore-api", { adesso: "errore" }],
  ["limite-uso", { adesso: "limite" }],
  ["interrotta-senza-strumento", { adesso: "interrotta", segni: ["interrotta"] }],
  ["errore-rete-riprova", { adesso: "riprova" }],
  ["compattazione", { segni: ["compattazione"] }],
  ["sessione-figlia", { segni: ["figlia"] }],
  ["messaggio-da-altra-sessione", { segni: ["messaggio_sessione"] }],
];
const CODEX: [string, Atteso][] = [
  ["al-lavoro", { adesso: "lavora" }],
  ["domanda-aperta", { adesso: "domanda", strumento: "request_user_input_async" }],
  ["aiutanti", { segni: ["aiutanti"] }],
  ["modifica-con-differenze", { segni: ["modifica"] }],
  ["ricerca-web", { segni: ["ricerca_web"] }],
  ["comando-fallito", { segni: ["comando_fallito"] }],
  ["compattazione", { segni: ["compattazione"] }],
  ["limite-uso", { adesso: "limite", segni: ["limite"] }],
  ["turno-finito", { adesso: "turno_finito" }],
  ["interrotta", { adesso: "interrotta", segni: ["interrotta"] }],
  ["errore-turno", { adesso: "errore" }],
];

function controlla(s: Sessione, a: Atteso) {
  const x = s.situazione!;
  assert.ok(x, "situazione non letta");
  if (a.adesso) assert.equal(x.adesso, a.adesso);
  if (a.strumento) assert.equal(x.strumento, a.strumento);
  if (a.inCoda !== undefined) assert.equal(x.inCoda, a.inCoda);
  for (const g of a.segni ?? []) assert.ok(x.segni.includes(g), `manca il segno ${g}: ${JSON.stringify(x)}`);
}

for (const [nome, a] of CLAUDE) test(`Claude: ${nome}`, () => controlla(leggi("claude", nome), a));
for (const [nome, a] of CODEX) test(`Codex: ${nome}`, () => controlla(leggi("codex", nome), a));

test("le fixture non coprono altro: ogni file ha la sua riga nel catalogo dei test", () => {
  for (const [sorg, righe] of [["claude", CLAUDE], ["codex", CODEX]] as const) {
    const file = fs.readdirSync(path.join(FIX, sorg)).map((n) => n.replace(/\.jsonl$/, "")).sort();
    assert.deepEqual(file, righe.map(([n]) => n).sort());
  }
});

test("trascrizione troncata a metà riga: la riga tagliata si salta, la situazione resta", () => {
  controlla(leggi("claude", "domanda-aperta", '{"type":"user","message":{"cont'), { adesso: "domanda" });
});

test("sessione cancellata mentre la guardi: sparisce dall'elenco, nessun errore", () => {
  const s = leggi("claude", "turno-finito");
  const home = s.file.split("/.claude/")[0];
  fs.unlinkSync(s.file);
  assert.deepEqual(leggiElenco({ home, env: {}, ora: ORA }), { sessioni: [], errori: [] });
});

// Situazioni senza un esempio vero sul Mac (cercate su 40 giorni, 9 radici): restano in attesa, non finte.
for (const s of [
  "Claude: piano rifiutato (nessun esempio vero)",
  "Claude: /clear e cambio di modello (nessun esempio vero)",
  "Cursor: tutte le situazioni (nessuna trascrizione Cursor sul Mac)",
  "App Claude desktop: «in corso» (il file vero non ha isRunning; manca il campo giusto)",
]) test(`attende dati veri: ${s}`, { todo: true }, () => {});
