import { strict as assert } from "node:assert";
import { test } from "node:test";
import { archiviate } from "../src/impostazioni";
import type { SessioneApp } from "../src/desktop";

const app = (o: Partial<SessioneApp>): SessioneApp => ({
  idApp: "local_x", cliId: "x", titolo: "T", cartella: "/Users/x/clotch", ramo: null, modello: null, inCorso: false, archiviata: true,
  ultimaAttivita: Date.UTC(2026, 9, 22, 18, 40), profilo: "Claude", file: "f", ...o,
});

test("archiviate: solo le archiviate, la più recente prima, «dove» = «<progetto> · <data e ora>»", () => {
  const r = archiviate([
    app({ cliId: "vecchia", titolo: "Vecchia", cartella: "/Users/x/squadd-v2", ultimaAttivita: Date.UTC(2026, 9, 19, 9, 15) }),
    app({ cliId: "viva", archiviata: false }),
    app({ cliId: "nuova", titolo: "Nuova" }),
  ], "UTC");
  assert.deepEqual(r, [
    { id: "nuova", titolo: "Nuova", dove: "clotch · 22 ott 2026, 18:40" },
    { id: "vecchia", titolo: "Vecchia", dove: "squadd-v2 · 19 ott 2026, 09:15" },
  ]);
});

test("archiviate: senza cartella o senza data «dove» ha solo quello che c'è", () => {
  const r = archiviate([app({ cartella: null, cliId: "a" }), app({ ultimaAttivita: null, cliId: "b" })], "UTC");
  assert.deepEqual(r.map((x) => x.dove).sort(), ["22 ott 2026, 18:40", "clotch"]);
});
