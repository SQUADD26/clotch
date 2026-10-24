// #837: la ricerca delle impostazioni trova ogni sezione e ogni riga scritta nelle pagine (l'indice è una copia: qui si vede se perde pezzi).
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { cerca, VOCI } from "../src/ui/impostazioni/voci-ricerca";
import { SEZIONI } from "../src/ui/impostazioni/sezioni";

const cartella = path.join(__dirname, "..", "..", "src", "ui", "impostazioni");

test("ogni riga con un'etichetta scritta in una pagina è una voce della ricerca", () => {
  const etichette = VOCI.map((v) => v.etichetta);
  for (const f of fs.readdirSync(cartella).filter((x) => x.endsWith(".tsx"))) {
    for (const [, e] of fs.readFileSync(path.join(cartella, f), "utf8").matchAll(/<Riga etichetta="([^"]+)"/g)) {
      assert.ok(etichette.includes(e), `${f}: «${e}» manca in voci-ricerca.ts`);
    }
  }
});

test("ogni sezione si trova col suo nome", () => {
  for (const [id, nome] of SEZIONI) assert.ok(cerca(nome).some((v) => v.sezione === id && v.etichetta === nome), nome);
  for (const q of ["archiviate", "info", "elimina", "uso", "account"]) assert.ok(cerca(q).length > 0, q);
});
