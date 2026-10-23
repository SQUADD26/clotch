import { strict as assert } from "node:assert";
import { test } from "node:test";
import { archiviate } from "../src/impostazioni";
import type { SessioneApp } from "../src/desktop";

const app = (o: Partial<SessioneApp>): SessioneApp => ({
  idApp: "local_x", cliId: "x", titolo: "T", cartella: "/Users/x/clotch", ramo: null, modello: null, inCorso: false, archiviata: true,
  ultimaAttivita: Date.UTC(2026, 9, 22, 18, 40), profilo: "Claude", file: "f", ...o,
});
type Reg = Parameters<typeof archiviate>[1];
const reg = (o: { chat?: Record<string, object>; comandi?: { id: string; cmd: string; t: number; args: object; esito?: string }[] } = {}): Reg => ({
  chat: new Map(Object.entries(o.chat ?? {})) as unknown as Reg["chat"],
  comandi: (o.comandi ?? []).map(({ esito, ...c }) => ({ da: "app", ...c })) as Reg["comandi"],
  esiti: new Map((o.comandi ?? []).filter((c) => c.esito).map((c) => [c.id, { esito: c.esito!, testo: "" }])),
});

test("archiviate: solo le archiviate, la più recente prima, «dove» = «<progetto> · <data e ora>»", () => {
  const r = archiviate([
    app({ cliId: "vecchia", titolo: "Vecchia", cartella: "/Users/x/squadd-v2", ultimaAttivita: Date.UTC(2026, 9, 19, 9, 15) }),
    app({ cliId: "viva", archiviata: false }),
    app({ cliId: "nuova", titolo: "Nuova" }),
  ], reg(), "UTC");
  assert.deepEqual(r, [
    { id: "nuova", titolo: "Nuova", dove: "clotch · 22 ott 2026, 18:40" },
    { id: "vecchia", titolo: "Vecchia", dove: "squadd-v2 · 19 ott 2026, 09:15" },
  ]);
});

test("archiviate: senza cartella o senza data «dove» ha solo quello che c'è", () => {
  const r = archiviate([app({ cartella: null, cliId: "a" }), app({ ultimaAttivita: null, cliId: "b" })], reg(), "UTC");
  assert.deepEqual(r.map((x) => x.dove).sort(), ["22 ott 2026, 18:40", "clotch"]);
});

test("archiviate: registro di clotch AI (fine archiviata, comando archivia riuscito) unito all'app senza doppioni, data = archiviazione", () => {
  const t = (g: number) => Date.UTC(2026, 9, g, 12, 0);
  const r = archiviate(
    [app({ cliId: "c1", titolo: "Dall'app", ultimaAttivita: t(1) }), app({ cliId: "c4", archiviata: false })],
    reg({
      chat: {
        c1: { titolo: "Dal registro", progetto: "/Users/x/altro", fine: "archiviata", fineT: t(25) },
        c2: { titolo: "Solo registro", progetto: "clotch-ai", fine: "archiviata", fineT: t(24) },
        c3: { titolo: "Da comando", progetto: null, fine: null, fineT: null },
        c4: { titolo: "Ripristinata dall'app", progetto: "x", fine: "archiviata", fineT: t(26) },
        c5: { titolo: "Uscita normale", progetto: "x", fine: "uscita", fineT: t(27) },
      },
      comandi: [
        { id: "k1", cmd: "archivia", t: t(23), args: { chat: "c3" }, esito: "ok" },
        { id: "k2", cmd: "archivia", t: t(28), args: { chat: "c5" }, esito: "rifiutato" },
      ],
    }), "UTC");
  assert.deepEqual(r, [
    { id: "c1", titolo: "Dall'app", dove: "clotch · 25 ott 2026, 12:00" },
    { id: "c2", titolo: "Solo registro", dove: "clotch-ai · 24 ott 2026, 12:00" },
    { id: "c3", titolo: "Da comando", dove: "23 ott 2026, 12:00" },
  ]);
});
