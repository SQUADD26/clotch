// Cache di leggiApp (#456): ogni local_*.json si rilegge solo se è cambiato (inode:mtime:ctime:size).
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiApp } from "../src/desktop";

const J = (id: string, extra: object = {}) => JSON.stringify({ sessionId: id, cliSessionId: `cli-${id}`, title: "t", lastActivityAt: 1, ...extra });
function home(n: number) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-cache-"));
  const dir = path.join(h, "Library", "Application Support", "Claude", "claude-code-sessions", "a", "b");
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, `local_${i}.json`), J(`local_${i}`));
  return { dir, giro: () => leggiApp(h, []) };
}
/** Quante volte `f` legge un `local_*.json`. */
function letture(t: any, f: () => void) {
  const spia = t.mock.method(require("node:fs"), "readFileSync");
  try {
    f();
    return spia.mock.calls.filter((c: any) => /local_[^/]*\.json$/.test(String(c.arguments[0]))).length;
  } finally {
    spia.mock.restore();
  }
}

test("leggiApp: file invariati non si rileggono; cambiato o nuovo sì; sparito esce", (t) => {
  const { dir, giro } = home(5);
  assert.equal(letture(t, giro), 5, "il primo giro legge i cinque file");
  assert.equal(letture(t, giro), 0, "giro invariato: nessuna lettura");
  fs.writeFileSync(path.join(dir, "local_1.json"), J("local_1", { title: "nuovo titolo" }));
  fs.writeFileSync(path.join(dir, "local_9.json"), J("local_9"));
  fs.unlinkSync(path.join(dir, "local_0.json"));
  let r: ReturnType<typeof giro> = [];
  assert.equal(letture(t, () => (r = giro())), 2, "solo il file cambiato e quello nuovo");
  assert.equal(r.length, 5);
  assert.equal(r.find((s) => s.idApp === "local_1")!.titolo, "nuovo titolo");
  assert.ok(!r.some((s) => s.idApp === "local_0"));
});

test("leggiApp: stesso mtime e stessa misura ma contenuto diverso = riletto", () => {
  const { dir, giro } = home(1), f = path.join(dir, "local_0.json");
  fs.writeFileSync(f, J("local_0", { title: "AAAA" }));
  assert.equal(giro()[0].titolo, "AAAA");
  const m = fs.statSync(f).mtime;
  fs.writeFileSync(f, J("local_0", { title: "BBBB" }));
  fs.utimesSync(f, m, m);
  assert.equal(giro()[0].titolo, "BBBB");
});

test("leggiApp: file a metà scrittura saltato e ritentato; file scartato (attività pianificata) non si rilegge", (t) => {
  const { dir, giro } = home(1), f = path.join(dir, "local_0.json");
  fs.writeFileSync(f, '{"sessionId": "local_0", "cliSes');
  assert.deepEqual(giro(), []);
  fs.writeFileSync(f, J("local_0", { scheduledTaskId: "x" }));
  assert.deepEqual(giro(), []);
  assert.equal(letture(t, giro), 0, "scartato ma invariato: non si rilegge");
  fs.writeFileSync(f, J("local_0"));
  assert.equal(giro().length, 1);
});

test("leggiApp: misura di un giro con 500 file", (t) => {
  const { giro } = home(500);
  let p = Date.now();
  const n1 = letture(t, giro), msPrimo = Date.now() - p;
  p = Date.now();
  const n2 = letture(t, giro), msSecondo = Date.now() - p;
  console.log(`MISURA 500 file: primo giro ${n1} letture ${msPrimo} ms, secondo ${n2} letture ${msSecondo} ms`);
  assert.equal(n2, 0);
});
