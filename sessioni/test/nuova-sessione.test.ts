// «Nuova sessione» (#468): cartelle recenti, host SSH, rami git (repo vero in una cartella temporanea), argomenti del comando.
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { COMANDI } from "../src/clotch-ai";
import { cartelleRecenti, contestoGit } from "../src/nuova-sessione";
import { argsNuovaSessione, gruppiRami, LOCALE, notaAvvio } from "../src/ui/chat/avvio";

test("nuova_sessione è un comando del motore", () => assert.ok((COMANDI as readonly string[]).includes("nuova_sessione")));

test("cartelle recenti: dalla più recente, senza doppioni né vuote", () => {
  const r = cartelleRecenti([
    { cartella: "/r/vecchia", ultimaAttivita: 1 }, { cartella: "", ultimaAttivita: 9 }, { cartella: "/r/nuova", ultimaAttivita: 5 }, { cartella: "/r/vecchia", ultimaAttivita: 7 },
  ]);
  assert.deepEqual(r, [{ percorso: "/r/vecchia", nome: "vecchia" }, { percorso: "/r/nuova", nome: "nuova" }]);
});

test("rami di un repo: dev di partenza; una cartella senza git non ha rami", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nuova-"));
  const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { stdio: "pipe" });
  git("init", "-q", "-b", "main"); git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x");
  git("branch", "dev"); git("branch", "feat/1-a");
  const c = await contestoGit(dir);
  assert.equal(c.git, true); assert.equal(c.predefinito, "dev"); assert.deepEqual([...c.rami].sort(), ["dev", "feat/1-a", "main"]);
  const senza = fs.mkdtempSync(path.join(os.tmpdir(), "senza-"));
  assert.deepEqual(await contestoGit(senza), { git: false, rami: [], predefinito: null });
  assert.deepEqual(await contestoGit("relativo"), { git: false, rami: [], predefinito: null });
});

test("argomenti: macchina solo con ssh; ramo e worktree solo in un repo", () => {
  const base = { cartella: "/r/x", prompt: "ciao", modello: "claude-opus-5-5", sforzo: "high" };
  assert.deepEqual(argsNuovaSessione({ ...base, ambiente: LOCALE, git: { ramo: "dev", worktree: true } }),
    { ambiente: "locale", cartella: "/r/x", worktree: true, branch: "dev", modello: "claude-opus-5-5", sforzo: "high", prompt: "ciao" });
  assert.deepEqual(argsNuovaSessione({ ...base, ambiente: { tipo: "ssh", host: "rise" }, git: null }),
    { ambiente: "ssh", macchina: "rise", cartella: "/r/x", modello: "claude-opus-5-5", sforzo: "high", prompt: "ciao" });
  assert.equal(argsNuovaSessione({ ...base, ambiente: LOCALE, git: null, account: "squadd@example.com" }).account, "squadd@example.com");
  assert.equal("account" in argsNuovaSessione({ ...base, ambiente: LOCALE, git: null, account: null }), false);
});

test("menu ramo: predefiniti e altri; col testo un elenco solo; nessun risultato", () => {
  const rami = ["feat/437-a", "main", "dev", "test/437-b"];
  assert.deepEqual(gruppiRami(rami, ""), [{ titolo: "Predefiniti", rami: ["dev", "main"] }, { titolo: "Altri rami", rami: ["feat/437-a", "test/437-b"] }]);
  assert.deepEqual(gruppiRami(rami, "437"), [{ titolo: null, rami: ["feat/437-a", "test/437-b"] }]);
  assert.deepEqual(gruppiRami(rami, "zzz"), []);
});

test("riga sotto i selettori", () => {
  assert.equal(notaAvvio(true, "dev", "goal-notch"), "Crea un ramo nuovo da dev in una cartella separata.");
  assert.equal(notaAvvio(false, "dev", "goal-notch"), "Lavora su dev direttamente dentro goal-notch.");
});
