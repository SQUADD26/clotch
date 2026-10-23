import { test } from "node:test";
import * as assert from "node:assert/strict";
import { copriChiavi, nomeComando } from "../src/ui/chat/chiavi";

const C = "••••";
test("copriChiavi copre i formati comuni", () => {
  const casi: [string, string][] = [
    ["uso sk-ant-api03-abcdefghijklmnopqrstuvwx qui", `uso ${C} qui`],
    ["sk-proj_abcdefghijklmnopqrstuvwxyz1234", C],
    ["ghp_abcdefghijklmnopqrstuvwxyz0123456789", C],
    ["gho_abcdefghijklmnopqrstuvwxyz0123456789", C],
    ["github_pat_11ABCDEFG0abcdefghij_klmnop", C],
    ["xoxb-1234567890-abcdefghij", C],
    ["id AKIAIOSFODNN7EXAMPLE fine", `id ${C} fine`],
    ["curl -H 'Authorization: Bearer abcdef1234567890XYZ.tok' x", `curl -H 'Authorization: Bearer ${C}' x`],
    ["ANTHROPIC_API_KEY=abc123 node a.js", `ANTHROPIC_API_KEY=${C} node a.js`],
    ["GH_TOKEN=\"valore con spazi\" gh pr list", `GH_TOKEN=${C} gh pr list`],
    ["DB_PASSWORD='x y' SECRET=z", `DB_PASSWORD=${C} SECRET=${C}`],
    ["jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N", `jwt ${C}`],
  ];
  for (const [dentro, fuori] of casi) assert.equal(copriChiavi(dentro), fuori);
});

test("copriChiavi lascia stare hash git, uuid e testo normale", () => {
  for (const t of [
    "commit 9be962a1d06fe03b2c1f6a8e5d4c3b2a19087654", "id 3f2b8c1e-9d4a-4c7e-8b1a-5e6f7a8b9c0d", "task-managementsystem-with-longname-here",
    "git push origin dev", "KEYBOARD=us", "il token è scaduto, la password pure", "PATH=/usr/bin", "sk-corto",
  ]) assert.equal(copriChiavi(t), t);
});

test("nomeComando: la prima parola, senza variabili davanti", () => {
  assert.equal(nomeComando("git push origin main"), "git");
  assert.equal(nomeComando("  npm  test"), "npm");
  assert.equal(nomeComando("FOO=1 BAR=2 node a.js"), "node");
  assert.equal(nomeComando(""), "");
});
