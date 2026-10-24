import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Sessioni } from "../src/api";
import { leggiElenco } from "../src/elenco";

// #463: la prima lettura di molte sessioni gira in un worker; il main resta libero e riceve l'elenco finito.
test("avvio: la prima lettura non blocca il main e l'elenco arriva intero", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "avvio-463-"));
  const dir = path.join(home, ".claude", "projects", "-Users-x-app");
  fs.mkdirSync(dir, { recursive: true });
  const N = 8000, riga = (o: object) => JSON.stringify(o) + "\n";
  for (let i = 0; i < N; i++) {
    const id = `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const grande = "x ".repeat(2000); // righe lunghe: il parse è il costo, come nelle trascrizioni vere
    fs.writeFileSync(path.join(dir, `${id}.jsonl`),
      riga({ type: "user", sessionId: id, cwd: "/Users/x/app", message: { role: "user", content: `sessione ${i} ${grande}` } }).repeat(6) +
      riga({ type: "assistant", sessionId: id, cwd: "/Users/x/app", message: { role: "assistant", content: [{ type: "text", text: grande }] } }).repeat(6));
  }
  const s = new Sessioni(home);
  let ultimo = Date.now(), massimo = 0;
  const ping = setInterval(() => { const n = Date.now(); massimo = Math.max(massimo, n - ultimo - 10); ultimo = n; }, 10);
  const t0 = Date.now();
  try {
    await s.osservaInWorker(() => {});
    const durata = Date.now() - t0;
    await new Promise((r) => setTimeout(r, 30)); // un blocco sarebbe registrato dal tick in ritardo
    clearInterval(ping);
    assert.equal(s.elencoSessioni().sessioni.length, N);
    assert.ok(durata > 300, `la lettura deve durare abbastanza da provare qualcosa (${durata} ms)`);
    assert.ok(massimo < 150, `main bloccato ${massimo} ms durante la lettura (${durata} ms)`);
    // la cache è passata al main: una lettura qui rilegge solo i file cambiati, non tutti (altrimenti il primo evento bloccherebbe il main)
    const t1 = Date.now();
    assert.equal(leggiElenco({ home }).sessioni.length, N);
    assert.ok(Date.now() - t1 < durata / 3, `cache non passata al main (${Date.now() - t1} ms contro ${durata} ms)`);
  } finally {
    clearInterval(ping);
    (s as any).oss?.ferma();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
