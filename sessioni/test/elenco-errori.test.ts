// Renderer (#474): le cartelle non lette (`errori`) viaggiano con l'aggiornamento; prima di #485 ogni evento rileggeva l'elenco intero e le aggiornava.
import test from "node:test";
import assert from "node:assert/strict";
import { applicaElenco } from "../src/ui/base/elenco";

const s = (id: string, t: number) => ({ id, ultimaAttivita: t, titolo: id }) as any;
const vale = () => true;
const rotta = { percorso: "/x/projects", messaggio: "EACCES" };

test("elenco: una cartella che diventa illeggibile compare, e sparisce quando torna leggibile", () => {
  const e = { sessioni: [s("a", 3), s("b", 2)], errori: [] };
  const n = applicaElenco(e, { cambiate: [], tolte: ["b"], errori: [rotta] }, vale)!;
  assert.deepEqual(n.errori, [rotta]);
  const m = applicaElenco(n, { cambiate: [s("b", 2)], tolte: [], errori: [] }, vale)!;
  assert.deepEqual(m.errori, []);
  assert.equal(applicaElenco(n, { cambiate: [], tolte: [], errori: [rotta] }, vale), n); // uguali: stesso oggetto
});
