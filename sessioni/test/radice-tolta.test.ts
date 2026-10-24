// Account tolto e rimesso a app aperta (#474): l'ultima lettura della sua cartella non resta in memoria, e al ritorno si rilegge (non si mostra l'elenco vecchio).
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiElenco } from "../src/elenco";

const riga = JSON.stringify({ type: "user", cwd: "/Users/x/app", message: { role: "user", content: "ciao" } }) + "\n";
const ID1 = "aaaaaaaa-0000-4000-8000-000000000001", ID2 = "aaaaaaaa-0000-4000-8000-000000000002";

test("account tolto poi rimesso: le sessioni nate nel frattempo ci sono, senza aspettare un evento", (t) => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "radice-tolta-"));
  t.after(() => fs.rmSync(h, { recursive: true, force: true }));
  const p = path.join(h, ".claude-b", "projects", "-Users-x-app");
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, `${ID1}.jsonl`), riga);
  const ids = (imp: Record<string, unknown>, sporchi: string[]) =>
    leggiElenco({ home: h, env: {}, impostazioni: { cronologia: "Per sempre", ...imp }, sporchi }).sessioni.map((s) => s.id).sort();
  assert.deepEqual(ids({}, []), [ID1]);
  assert.deepEqual(ids({ accountTolti: ["~/.claude-b"] }, []), []);
  fs.writeFileSync(path.join(p, `${ID2}.jsonl`), riga); // mentre l'account è tolto
  assert.deepEqual(ids({}, []), [ID1, ID2]); // impostazioni() fa un giro senza percorsi toccati
});
