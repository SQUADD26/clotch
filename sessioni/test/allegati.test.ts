// Allegati, immagini e skill della casella (#437): peso, percorsi in fondo al messaggio, immagini della trascrizione, galleria del visore.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { descrivi, leggiImmagine, leggiSkill } from "../src/allegati";
import { Convertitore } from "../src/messaggi-claude";
import type { Messaggio } from "../src/tipi";
import { voci } from "../src/ui/chat/modello";
import { conPercorsi, galleria, peso, senzaPercorsi } from "../src/ui/chat/percorsi";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");
const B64 = PNG.toString("base64");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "allegati-"));

test("peso: a mille come il Finder, con la virgola italiana", () => {
  assert.deepEqual([312_000, 4_000, 999, 1_200_000, null].map(peso), ["312 KB", "4 KB", "999 B", "1,2 MB", ""]);
});

test("percorsi in fondo al messaggio: scritti una riga ciascuno e riletti uguali", () => {
  const p = ["/Users/r/Desktop/schermata.png", "/Users/r/Mio file.ts"];
  const t = conPercorsi("Guarda qui", p);
  assert.equal(t, 'Guarda qui\n@/Users/r/Desktop/schermata.png\n@"/Users/r/Mio file.ts"');
  assert.deepEqual(senzaPercorsi(t), { testo: "Guarda qui", percorsi: p });
  assert.equal(conPercorsi("Ciao", []), "Ciao");
  // un @ nel mezzo del testo non è un allegato; la prima riga resta sempre testo
  assert.deepEqual(senzaPercorsi("scrivi a @/tmp/x oggi"), { testo: "scrivi a @/tmp/x oggi", percorsi: [] });
  assert.deepEqual(senzaPercorsi("@/tmp/solo"), { testo: "@/tmp/solo", percorsi: [] });
});

test("trascrizione: le immagini incollate stanno sul testo, quelle di un esito sullo strumento, solo con l'uuid della riga", () => {
  const c = new Convertitore();
  const img = { type: "image", source: { type: "base64", media_type: "image/png", data: B64 } };
  const a = c.riga({ type: "user", uuid: "u-0001-aaaa", imagePasteIds: [3], message: { content: [{ type: "text", text: "[Image #3] guarda" }, img] } });
  assert.deepEqual(a.nuovi, [{ tipo: "utente", testo: "[Image #3] guarda", t: null, immagini: [{ riga: "u-0001-aaaa", n: 0, mime: "image/png", byte: PNG.length, nome: "Immagine 3" }] }]);
  c.riga({ type: "assistant", message: { content: [{ type: "tool_use", id: "tu1", name: "Read", input: { file_path: "/a/b.png" } }] } });
  const r = c.riga({ type: "user", uuid: "u-0002-bbbb", message: { content: [{ type: "tool_result", tool_use_id: "tu1", content: [img] }] } });
  assert.deepEqual(r.aggiornati[0].esito, { testo: "", errore: false, immagini: [{ riga: "u-0002-bbbb", n: 0, mime: "image/png", byte: PNG.length }] });
  const senza = new Convertitore().riga({ type: "user", message: { content: [{ type: "text", text: "x" }, img] } });
  assert.deepEqual(senza.nuovi, [{ tipo: "utente", testo: "x", t: null }]);
});

test("immagine di una riga: si rilegge dalla trascrizione per uuid e posizione, e solo se il riferimento è valido", async () => {
  const dir = tmp(), file = path.join(dir, "s.jsonl");
  const img = (d: string) => ({ type: "image", source: { type: "base64", media_type: "image/png", data: d } });
  fs.writeFileSync(file, [
    JSON.stringify({ type: "user", uuid: "uuid-prima-0001", message: { content: [{ type: "text", text: "no" }] } }),
    JSON.stringify({ type: "user", uuid: "uuid-righe-0002", message: { content: [{ type: "text", text: "sì" }, img("QUE="), { type: "tool_result", tool_use_id: "t", content: [img("QkI=")] }] } }),
  ].join("\n") + "\n");
  const file_di = (id: string) => (id === "s1" ? file : null);
  const rif = (n: number, riga = "uuid-righe-0002") => ({ sessione: "s1", rif: { riga, n, mime: "image/png", byte: 1 } });
  assert.deepEqual(await leggiImmagine(rif(0), file_di), { mime: "image/png", base64: "QUE=" });
  assert.deepEqual(await leggiImmagine(rif(1), file_di), { mime: "image/png", base64: "QkI=" });
  assert.equal(await leggiImmagine(rif(2), file_di), null, "posizione oltre le immagini della riga");
  assert.equal(await leggiImmagine(rif(0, "uuid-che-non-c-e"), file_di), null);
  assert.equal(await leggiImmagine(rif(0, '"; rm -rf'), file_di), null, "uuid non valido");
  assert.equal(await leggiImmagine({ ...rif(0), sessione: "altra" }, file_di), null, "sessione sconosciuta");
});

test("immagine su disco: solo file immagine e percorsi assoluti; descrivi dice tipo e peso", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "a.png"), PNG);
  fs.writeFileSync(path.join(dir, "b.ts"), "x");
  fs.mkdirSync(path.join(dir, "cartella"));
  assert.equal((await leggiImmagine({ percorso: path.join(dir, "a.png") }, () => null))?.mime, "image/png");
  assert.equal(await leggiImmagine({ percorso: path.join(dir, "b.ts") }, () => null), null);
  assert.equal(await leggiImmagine({ percorso: "a.png" }, () => null), null);
  assert.deepEqual(descrivi([path.join(dir, "a.png"), path.join(dir, "b.ts"), path.join(dir, "cartella"), path.join(dir, "manca"), "relativo"]).map((d) => [d.nome, d.tipo, d.byte]),
    [["a.png", "immagine", PNG.length], ["b.ts", "file", 1], ["cartella", "cartella", null]]);
});

test("skill: quelle dell'account, altrimenti di ~/.claude; niente cartelle nascoste né senza SKILL.md", () => {
  const home = tmp();
  for (const [d, n] of [[".claude", "ponytail"], [".claude", "app-copy"], [".claude", ".trash"], [".claude-x", "solo-x"]])
    { fs.mkdirSync(path.join(home, d, "skills", n), { recursive: true }); fs.writeFileSync(path.join(home, d, "skills", n, "SKILL.md"), "---\nname: x\n---\n"); }
  fs.mkdirSync(path.join(home, ".claude", "skills", "vuota"));
  assert.deepEqual(leggiSkill(home, ".claude-x"), [{ nome: "solo-x" }]);
  assert.deepEqual(leggiSkill(home, ".claude-senza"), [{ nome: "app-copy" }, { nome: "ponytail" }]);
  assert.deepEqual(leggiSkill(home, "../fuori"), [{ nome: "app-copy" }, { nome: "ponytail" }], "un account fuori da ~/.claude* non si segue");
});

test("filo: segnaposto e percorsi escono dal testo; il visore parte dall'immagine più recente", () => {
  const rif = (riga: string, nome?: string) => ({ riga, n: 0, mime: "image/png", byte: 1, ...(nome ? { nome } : {}) });
  const m: Messaggio[] = [
    { tipo: "utente", testo: "[Image #1] Guarda\n@/tmp/uno.png\n@/tmp/due.ts", t: 1, immagini: [rif("riga-0001-a", "Immagine 1")] },
    { tipo: "strumento", id: "t1", nome: "Screenshot", ingresso: { name: "pagina.png" }, esito: { testo: "", errore: false, immagini: [rif("riga-0002-b")] }, t: 2 },
  ];
  const v = voci(m, false);
  assert.deepEqual(v[0], { tipo: "roberto", chiave: "0-1", testo: "Guarda", immagini: m[0].tipo === "utente" ? m[0].immagini : undefined, percorsi: ["/tmp/uno.png", "/tmp/due.ts"] });
  assert.deepEqual(galleria(v, "s1").map((g) => g.nome), ["pagina.png", "uno.png", "Immagine 1"]);
});
