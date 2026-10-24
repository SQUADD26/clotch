// «Progetti» veri della barra (#891): il worktree sta sotto il suo repo, le prove nelle cartelle temporanee non compaiono,
// le chat senza cartella (scratch) stanno in un gruppo solo, la cartella vera non cambia.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiElenco } from "../src/elenco";
import { eProva, progettoDi, SENZA_CARTELLA } from "../src/progetto";

const SCRATCH = "/Users/x/Library/Application Support/Claude/scratch-workspaces/a/b/";

function casa(sessioni: Array<[string, string]>) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "progetti-veri-"));
  const p = path.join(h, ".claude", "projects", "-x");
  fs.mkdirSync(p, { recursive: true });
  sessioni.forEach(([cwd, titolo], i) =>
    fs.writeFileSync(path.join(p, `aaaaaaaa-0000-4000-8000-00000000000${i}.jsonl`), JSON.stringify({ type: "user", cwd, message: { role: "user", content: titolo } }) + "\n"));
  return h;
}

test("un worktree di .claude/worktrees va sotto il suo repo, anche da una sottocartella", () => {
  assert.equal(progettoDi("/Users/x/Repos/goal-notch/.claude/worktrees/437-app-completa-h883-52afe8"), "goal-notch");
  assert.equal(progettoDi("/work/r.bondici/goal-notch/.claude/worktrees/agent-a81/sessioni"), "goal-notch");
});

test("un worktree fuori da .claude/worktrees va sotto il repo di --git-common-dir", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "wt-"));
  const comune = path.join(d, "mio-repo", ".git"), gd = path.join(comune, "worktrees", "w1"), wt = path.join(d, "codex-w1");
  fs.mkdirSync(gd, { recursive: true }); fs.mkdirSync(wt);
  fs.writeFileSync(path.join(gd, "commondir"), "../..\n");
  fs.writeFileSync(path.join(wt, ".git"), `gitdir: ${gd}\n`);
  assert.equal(progettoDi(wt), "mio-repo");
  assert.equal(progettoDi(path.join(d, "mio-repo")), "mio-repo"); // la cartella vera resta com'è
});

test("la cartella vera resta quella: il nome dell'ultimo pezzo", () => {
  assert.equal(progettoDi("/Users/x/Documents/Repos/web"), "web");
  assert.equal(progettoDi("/Users/x/Documents/Repos/web/"), "web");
});

test("le scratch di Claude Desktop sono un gruppo solo", () => {
  assert.equal(progettoDi(`${SCRATCH}scratch-2026-10-24-df0d92`), SENZA_CARTELLA);
  assert.equal(progettoDi(`${SCRATCH}scratch-2026-10-23-deea5f`), SENZA_CARTELLA);
});

test("le prove automatiche: cartelle temporanee e titoli di prova", () => {
  for (const c of [os.tmpdir(), path.join(os.tmpdir(), "x", "y"), "/tmp/a", "/private/tmp/claude-501/pg/lavoro", "/private/var/folders/y_/T/z"])
    assert.equal(eProva({ cartella: c, titolo: "lavoro" }), true, c);
  assert.equal(eProva({ cartella: "/Users/x/app", titolo: "★ PROVA-2203 caso B2" }), false, "il titolo non decide");
  assert.equal(eProva({ cartella: "/Users/x/app", titolo: "CLOTCH_TEST giro" }), false);
  assert.equal(eProva({ cartella: "/Users/x/app", titolo: "Prova apertura #2355" }), false);
  assert.equal(eProva({ cartella: "/Users/x/tmp-app", titolo: "lavoro" }), false);
  assert.equal(eProva({ cartella: `${SCRATCH}scratch-2026-10-24-df0d92`, titolo: "PROVA-1 ma è una chat vera" }), false);
});

test("nell'elenco: worktree nel repo, prove fuori, scratch in uno, cartella vera invariata", () => {
  const h = casa([
    ["/Users/x/Repos/app", "vera"],
    ["/Users/x/Repos/app/.claude/worktrees/agent-1", "worktree"],
    [path.join(os.tmpdir(), "prova-1"), "in tmp"],
    ["/Users/x/Repos/app", "PROVA-7 caso"],
    [`${SCRATCH}scratch-2026-10-24-aaaaaa`, "chat uno"],
    [`${SCRATCH}scratch-2026-10-24-bbbbbb`, "chat due"],
  ]);
  const e = leggiElenco({ home: h });
  assert.deepEqual(e.sessioni.map((s) => [s.titolo, s.progetto]).sort(), [
    ["PROVA-7 caso", "app"], ["chat due", SENZA_CARTELLA], ["chat uno", SENZA_CARTELLA], ["vera", "app"], ["worktree", "app"],
  ]);
  assert.equal(leggiElenco({ home: h, conProve: true }).sessioni.length, 6); // le prove di collegamento le vedono
  assert.equal(e.sessioni.find((s) => s.titolo === "worktree")!.cartella, "/Users/x/Repos/app/.claude/worktrees/agent-1"); // la cartella vera della sessione non cambia
});
