import { test } from "node:test";
import * as assert from "node:assert/strict";
import { acceso } from "../src/ui/pannello/clotch";

const ora = 1_800_000_000_000;
const c = (voce: string, eta: number) => ({ clotch: { voce, parla: false, ascolta: false, t: ora - eta } });

test("Clotch acceso: voce accesa e evento giovane", () => assert.equal(acceso(c("accesa", 60_000), ora), true));
test("Clotch assente: nessun evento", () => assert.equal(acceso({ clotch: null }, ora), false));
test("Clotch spento: voce spenta", () => assert.equal(acceso(c("spenta", 1_000), ora), false));
test("Clotch spento: evento più vecchio di 10 min", () => assert.equal(acceso(c("accesa", 600_001), ora), false));
test("Clotch acceso: evento di esattamente 10 min", () => assert.equal(acceso(c("accesa", 600_000), ora), true));
