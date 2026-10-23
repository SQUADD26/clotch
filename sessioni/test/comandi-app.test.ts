import test from "node:test";
import assert from "node:assert/strict";
import { COMANDI_APP, eComandoApp, eseguiComandoApp } from "../src/comandi-app";
import { COMANDI } from "../src/clotch-ai";
import { fermaVoce, staParlando } from "../src/voce-app";

test("comandi dell'app: nessuno è un comando di clotch AI, quindi nessuno finisce nella casella", () => {
  for (const c of COMANDI_APP) assert.equal(eComandoApp(c), true);
  assert.equal(COMANDI.some((c) => (COMANDI_APP as readonly string[]).includes(c)), false);
  assert.equal(eComandoApp("ferma_tutto"), false);
});

test("voce_ferma senza frasi in corso è ok; in prova silenziosa il segnale a Clotch non parte e lo dice", async () => {
  process.env.CLOTCH_TEST_SILENT = "1";
  assert.equal(staParlando(), false);
  fermaVoce();
  assert.equal((await eseguiComandoApp("voce_ferma")).esito, "ok");
  for (const c of ["clotch_dettatura", "clotch_interrompi_voce"] as const) assert.equal((await eseguiComandoApp(c)).esito, "non_scritto");
});
