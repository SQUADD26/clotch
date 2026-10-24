// Filo compatto (#876): le chiamate di fila diventano un gruppo, ogni chiamata è detta in parole semplici.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { ConvertitoreCodex } from "../src/messaggi-altri";
import type { Messaggio } from "../src/tipi";
import { esitoErrore, fraseDi, raggruppa, type Gruppo } from "../src/ui/chat/gruppi";
import { voci } from "../src/ui/chat/modello";
import { frase } from "../src/ui/chat/strumenti";

const st = (id: string, nome: string, ingresso: unknown, esito: string | null, errore = false, t = 0): Messaggio =>
  ({ tipo: "strumento", id, nome, ingresso, esito: esito == null ? null : { testo: esito, errore }, t });
const turno = (ms: Messaggio[], vivo = true) => {
  const v = voci([{ tipo: "utente", testo: "Sistema la ricerca", t: 0 }, ...ms], vivo, "/Users/r/clotch");
  const t = v.find((x) => x.tipo === "turno");
  return t && t.tipo === "turno" ? raggruppa(t.blocchi) : [];
};

test("frase: ogni chiamata in parole semplici, verbo e oggetto (163:84207); il comando usa la sua descrizione", () => {
  assert.deepEqual(frase("mcp__claude-in-chrome__computer", { action: "screenshot" }), { verbo: "Fotografa", oggetto: "lo schermo" });
  assert.equal(esitoErrore("Exit code 2\nboom"), "· uscita 2");
  assert.equal(esitoErrore("boom"), "· non riuscito");
  assert.deepEqual(frase("Read", { file_path: "/Users/r/clotch/sessioni/src/ui/Ricerca.tsx" }), { verbo: "Legge", oggetto: "Ricerca.tsx" });
  assert.deepEqual(frase("Grep", { pattern: "useRiserva", path: "src" }, "Found 4 files\nsrc/a.ts\nsrc/b.ts\nsrc/c.ts\nsrc/d.ts"), { verbo: "Cerca", oggetto: '"useRiserva" in 4 file' });
  assert.deepEqual(frase("Grep", { pattern: "x" }, "src/a.ts:12:x\nsrc/a.ts:30:x\nsrc/b.ts:1:x"), { verbo: "Cerca", oggetto: '"x" in 2 file' });
  assert.deepEqual(frase("Grep", { pattern: "x", path: "/r/src" }, "No files found"), { verbo: "Cerca", oggetto: '"x" in src' });
  assert.deepEqual(frase("Glob", { pattern: "**/*.tsx" }, "a.tsx\nb.tsx\nc.tsx"), { verbo: "Trova", oggetto: '3 file "**/*.tsx"' });
  assert.deepEqual(frase("Bash", { command: "gh api 'repos/SQUADD26/clotch/issues'", description: "Legge le issue aperte" }), { verbo: "Legge le issue aperte", oggetto: "" });
  assert.deepEqual(frase("Bash", { command: "npm test" }), { verbo: "Esegue un comando", oggetto: "" });
  assert.deepEqual(frase("Edit", { file_path: "/a/b/Filo.tsx" }), { verbo: "Modifica", oggetto: "Filo.tsx" });
  assert.deepEqual(frase("WebFetch", { url: "https://www.developer.apple.com/design" }), { verbo: "Apre", oggetto: "developer.apple.com" });
  assert.deepEqual(frase("mcp__claude-in-chrome__read_page", {}), { verbo: "Usa", oggetto: "read page" });
});

test("una fila di chiamate è un gruppo con durata, errori e la chiamata in corso", () => {
  const b = turno([
    { tipo: "pensiero", testo: "guardo", t: 1000 },
    st("r", "Read", { file_path: "/Users/r/clotch/a.ts" }, "…", false, 2000),
    st("g", "Grep", { pattern: "x" }, "Found 2 files\na\nb", false, 5000),
    st("b", "Bash", { command: "npm test", description: "Lancia i test" }, "1 failing", true, 9000),
    st("c", "Bash", { command: "npm run build" }, null, false, 20000),
  ]);
  assert.deepEqual(b.map((x) => x.tipo), ["pensiero", "gruppo"]);
  const g = b[1] as Gruppo;
  assert.deepEqual(g.strumenti.map((x) => [fraseDi(x).verbo, fraseDi(x).oggetto].filter(Boolean).join(" ")), ["Legge a.ts", 'Cerca "x" in 2 file', "Lancia i test", "Esegue un comando"]);
  assert.equal(g.durata, 18000); // 3 s + 4 s + 11 s; quella in corso non ha ancora durata
  assert.deepEqual(g.errori.map((x) => x.id), ["b"]);
  assert.equal(g.inCorso?.id, "c");
  assert.equal(g.chiave, g.strumenti[0].chiave);
});

test("una risposta o un ragionamento in mezzo chiude il gruppo; aiutanti e attività restano fuori", () => {
  const b = turno([
    st("a", "Read", { file_path: "/x/a.ts" }, "…", false, 1),
    { tipo: "assistente", testo: "Ho letto, ora cerco.", modello: null, t: 2 },
    st("b", "Grep", { pattern: "y" }, "", false, 3),
    st("h", "Agent", { description: "Controlla i test" }, "fatto", false, 4),
    st("c", "WebSearch", { query: "HIG disclosure" }, "Links: []", false, 5),
  ], false);
  assert.deepEqual(b.map((x) => x.tipo), ["gruppo", "risposta", "gruppo", "aiutanti", "gruppo"]);
  assert.deepEqual(fraseDi((b[4] as Gruppo).strumenti[0]), { verbo: "Cerca sul web", oggetto: '"HIG disclosure"' });
});

test("turno con 300 chiamate: un solo gruppo, conti giusti, in poco tempo", () => {
  const ms = Array.from({ length: 300 }, (_, i) => st(`t${i}`, i % 3 ? "Read" : "Bash", { file_path: `/x/f${i}.ts`, command: "ls" }, i === 7 ? "no" : "ok", i === 7, i * 100));
  const t0 = performance.now();
  const b = turno(ms, false);
  assert.ok(performance.now() - t0 < 200);
  assert.equal(b.length, 1);
  assert.equal((b[0] as Gruppo).strumenti.length, 300);
  assert.equal((b[0] as Gruppo).errori.length, 1);
});

test("situazione vera Codex «comando-fallito»: il gruppo mostra l'errore", () => {
  const c = new ConvertitoreCodex();
  const righe = fs.readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", "situazioni", "codex", "comando-fallito.jsonl"), "utf8").split("\n").filter(Boolean);
  const g = turno(righe.flatMap((l) => c.riga(JSON.parse(l)).nuovi).filter((m) => m.tipo !== "utente"), false).find((x) => x.tipo === "gruppo") as Gruppo;
  assert.equal(g.errori.length, 1);
  assert.equal(fraseDi(g.errori[0]).verbo, "Esegue un comando");
});
