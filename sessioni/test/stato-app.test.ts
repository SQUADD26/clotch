import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afkAcceso, leggiStatoApp, schermoOccupato } from "../src/stato-app";

const ORA = 1_792_800_000_000;
const riga = (tipo: string, da: string, t: number) => JSON.stringify({ tipo, da, t, ...(tipo === "schermo_in_arrivo" ? { tra_ms: 1500 } : {}) });

test("schermo: occupato dal primo script che non ha scritto «libero»", () => {
  const righe = [riga("schermo_in_arrivo", "a", ORA - 42_000), riga("schermo_in_arrivo", "b", ORA - 10_000), riga("schermo_libero", "b", ORA - 5_000)].join("\n");
  assert.deepEqual(schermoOccupato(righe, ORA), { da: ORA - 42_000 });
});

test("schermo: libero quando ogni script ha scritto «libero», o la riga è vecchia di 60 s, o la coda è tagliata", () => {
  assert.equal(schermoOccupato([riga("schermo_in_arrivo", "a", ORA - 9_000), riga("schermo_libero", "a", ORA - 2_000)].join("\n"), ORA), null);
  assert.equal(schermoOccupato(riga("schermo_in_arrivo", "a", ORA - 60_000), ORA), null); // script morto: smette di contare
  assert.equal(schermoOccupato(`"tipo": "taglio\n${riga("schermo_in_arrivo", "a", ORA - 1_000)}\nnon json`, ORA)?.da, ORA - 1_000);
  assert.equal(schermoOccupato("", ORA), null);
});

test("AFK: acceso con gli avvisi dopo l'inizio; spento o file rotto = null", () => {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), "afk-"));
  const voce = path.join(casa, ".config", "voce"), clotch = path.join(casa, ".config", "clotch");
  fs.mkdirSync(voce, { recursive: true }); fs.mkdirSync(clotch, { recursive: true });
  assert.equal(afkAcceso(casa), null, "nessun file");
  fs.writeFileSync(path.join(voce, "afk.json"), JSON.stringify({ v: 1, attivo: true, inizio: 1000, fine: null }));
  fs.writeFileSync(path.join(clotch, "afk-fatto.jsonl"), [999, 1001, 1500, 2000].map((t) => JSON.stringify({ t, tipo: "fine_turno" })).join("\n") + "\nrotta\n");
  assert.deepEqual(afkAcceso(casa), { da: 1_000_000, avvisi: 3 });
  assert.deepEqual(leggiStatoApp(casa, ORA).afk, { da: 1_000_000, avvisi: 3 });
  fs.writeFileSync(path.join(voce, "afk.json"), JSON.stringify({ v: 1, attivo: false, inizio: 1000, fine: 3000 }));
  assert.equal(afkAcceso(casa), null);
  fs.writeFileSync(path.join(voce, "afk.json"), "{rotto");
  assert.equal(afkAcceso(casa), null);
  fs.rmSync(casa, { recursive: true });
});
