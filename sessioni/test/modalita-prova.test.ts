import test from "node:test";
import assert from "node:assert/strict";
import { provaSilenziosa } from "../src/modalita-prova";

test("silenzio di prova: solo CLOTCH_TEST_SILENT=1 abilita la guardia", () => {
  const prima = process.env.CLOTCH_TEST_SILENT;
  try {
    delete process.env.CLOTCH_TEST_SILENT;
    assert.equal(provaSilenziosa(), false);
    for (const valore of ["", "0", "true", "yes", " 1", "1 "]) {
      process.env.CLOTCH_TEST_SILENT = valore;
      assert.equal(provaSilenziosa(), false, JSON.stringify(valore));
    }
    process.env.CLOTCH_TEST_SILENT = "1";
    assert.equal(provaSilenziosa(), true);
    console.log("SILENT_MODE_EXACT_OK");
  } finally {
    if (prima === undefined) delete process.env.CLOTCH_TEST_SILENT;
    else process.env.CLOTCH_TEST_SILENT = prima;
  }
});
