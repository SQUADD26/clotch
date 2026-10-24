// La casella (#437): menu «/» e «@» con dati veri, scelte per chat, permessi e contesto dalla trascrizione, «Non inviato».
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cercaFile, comandiDi, COMANDI_BASE, descrizioneDi, leggiModelli } from "../src/casella-dati";
import { leggiElenco } from "../src/elenco";
import { cercaDi, conScelta, filtraComandi } from "../src/ui/chat/cerca-casella";
import { etichettaModello, haRapida, modelliMenu, modelloDi, motivoNonInviato, percentoContesto, permessiDi, sforziDi, sforzoDi } from "../src/ui/chat/scelte";

const cartella = () => fs.mkdtempSync(path.join(os.tmpdir(), "casella-"));
const scrivi = (f: string, t: string) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };

test("cercaDi: «/» solo come prima parola, «@» dopo uno spazio, fino a fine parola", () => {
  assert.deepEqual(cercaDi("/co", 3), { tipo: "comando", query: "co", da: 0, a: 3 });
  assert.deepEqual(cercaDi("/compact", 3), { tipo: "comando", query: "co", da: 0, a: 8 }); // cursore a metà: la parola intera si sostituisce
  assert.equal(cercaDi("/usr/bin", 8), null);
  assert.equal(cercaDi("scrivi /co", 10), null);
  assert.equal(cercaDi("/compact ora", 12), null);
  assert.deepEqual(cercaDi("Guarda @lett", 12), { tipo: "file", query: "lett", da: 7, a: 12 });
  assert.deepEqual(cercaDi("@", 1), { tipo: "file", query: "", da: 0, a: 1 });
  assert.equal(cercaDi("mail@dominio.it", 15), null); // una chiocciola dentro una parola non è una citazione
});

test("conScelta: la voce prende il posto del pezzo e il cursore va dopo", () => {
  const c = cercaDi("Guarda @lett e poi", 12)!;
  assert.deepEqual(conScelta("Guarda @lett e poi", c, "@sessioni/src/lettore.ts"), { testo: "Guarda @sessioni/src/lettore.ts e poi", caret: 32 });
  assert.deepEqual(conScelta("/co", cercaDi("/co", 3)!, "/compact"), { testo: "/compact ", caret: 9 });
});

test("filtraComandi: prima chi inizia con la ricerca, l'ordine resta", () => {
  const nomi = (q: string) => filtraComandi(COMANDI_BASE, q).map((c) => c.nome);
  assert.deepEqual(nomi("co").slice(0, 4), ["/compact", "/context", "/cost", "/config"]);
  assert.ok(nomi("view").includes("/review")); // dentro il nome, dopo quelli che iniziano
  assert.deepEqual(nomi("zzz"), []);
  assert.equal(nomi("").length, COMANDI_BASE.length);
});

test("descrizioneDi: description dell'intestazione, anche a capo; senza, la prima riga", () => {
  assert.equal(descrizioneDi("---\nname: x\ndescription: Rivede le modifiche\n---\n# Titolo"), "Rivede le modifiche");
  assert.equal(descrizioneDi('---\ndescription: "Con virgolette"\n---\n'), "Con virgolette");
  assert.equal(descrizioneDi("---\ndescription: >\n  Prima riga del testo\n  seconda\n---\n"), "Prima riga del testo");
  assert.equal(descrizioneDi("---\nname: x\n---\n\n# Fa una cosa\naltro"), "Fa una cosa");
  assert.equal(descrizioneDi("Solo testo\nsecondo"), "Solo testo");
});

test("comandiDi: base, poi comandi e skill dell'account e del progetto, senza doppioni né file illeggibili", () => {
  const account = cartella(), progetto = cartella();
  scrivi(path.join(account, "commands", "deploy.md"), "---\ndescription: Spedisce\n---\n");
  scrivi(path.join(account, "commands", "compact.md"), "---\ndescription: Falso doppione\n---\n"); // un comando di base non si riscrive
  scrivi(path.join(account, "skills", "unlazy", "SKILL.md"), "---\ndescription: Lavoro lungo\n---\n");
  fs.mkdirSync(path.join(account, "skills", "vuota")); // cartella senza SKILL.md
  scrivi(path.join(progetto, ".claude", "commands", "prova.md"), "# Prova il progetto\n");
  const v = comandiDi(account, progetto);
  assert.deepEqual(v.slice(0, COMANDI_BASE.length), COMANDI_BASE);
  assert.deepEqual(v.slice(COMANDI_BASE.length), [
    { nome: "/deploy", descrizione: "Spedisce", gruppo: "Comandi" },
    { nome: "/prova", descrizione: "Prova il progetto", gruppo: "Comandi" },
    { nome: "/unlazy", descrizione: "Lavoro lungo", gruppo: "Skill" },
  ]);
  assert.deepEqual(comandiDi(null, "/non/esiste"), COMANDI_BASE);
});

test("cercaFile: con git conta .gitignore; senza, il giro salta le cartelle pesanti; il nome conta più del percorso", async () => {
  const d = cartella();
  scrivi(path.join(d, "src", "lettore.ts"), ""); scrivi(path.join(d, "src", "lettore.test.ts"), ""); scrivi(path.join(d, "src", "lettura", "cartelle.ts"), "");
  scrivi(path.join(d, "docs", "lettere.md"), ""); scrivi(path.join(d, "node_modules", "lettore", "index.js"), ""); scrivi(path.join(d, "segreto", "lett.txt"), "");
  const senzaGit = await cercaFile(d, "lett");
  assert.deepEqual(senzaGit, ["segreto/lett.txt", "src/lettore.ts", "docs/lettere.md", "src/lettore.test.ts", "src/lettura/cartelle.ts"]); // node_modules fuori; nome corto prima
  assert.deepEqual(await cercaFile(d, "lett", 2), senzaGit.slice(0, 2));
  assert.deepEqual(await cercaFile("/non/esiste", "x"), []);

  const g = cartella();
  execFileSync("git", ["init", "-q"], { cwd: g });
  scrivi(path.join(g, ".gitignore"), "ignorata/\n"); scrivi(path.join(g, "a", "lettore.ts"), ""); scrivi(path.join(g, "ignorata", "lettore.ts"), "");
  assert.deepEqual(await cercaFile(g, "lettore"), ["a/lettore.ts"]);
});

test("scelte: permessi e modello dalla chat o dalla trascrizione, contesto in percentuale", () => {
  assert.equal(permessiDi({ permessi: "plan" }), "plan");
  assert.equal(permessiDi({ permessi: "plan" }, { permessi: "acceptEdits" }), "acceptEdits"); // vince la scelta fatta qui
  assert.equal(permessiDi({ permessi: "boh" }), "default");
  assert.equal(permessiDi({}), "default");
  assert.equal(modelloDi({ modello: "claude-opus-5-5-20261001" }), "claude-opus-5-5"); // suffisso di data
  assert.equal(modelloDi({ modello: "claude-opus-5-5" }, { modello: "claude-fable-5-1" }), "claude-fable-5-1");
  assert.equal(etichettaModello("claude-fable-5-1"), "Fable 5.1");
  assert.equal(etichettaModello("claude-boh"), undefined);
  assert.equal(sforzoDi().id, "medium");
  assert.equal(sforzoDi({ sforzo: "max" }).etichetta, "Massimo");
  assert.equal(sforzoDi({ sforzo: "boh" }).id, "medium");
  assert.equal(percentoContesto(124_000, 200_000), 62);
  assert.equal(percentoContesto(100_000, 400_000), 25);
  assert.equal(percentoContesto(999_999, 200_000), 100);
  assert.equal(percentoContesto(null, 200_000), null);
  assert.equal(percentoContesto(100_000, null), null); // senza contesto_max nessuna percentuale
  assert.equal(percentoContesto(100_000, undefined), null);
});

test("motivoNonInviato: il perché dall'esito del comando", () => {
  assert.equal(motivoNonInviato({ id: "1", esito: "scaduto", testo: "", preso: false }), "Non inviato: la sessione non risponde.");
  assert.equal(motivoNonInviato(null), "Non inviato: la sessione non è raggiungibile.");
  assert.equal(motivoNonInviato({ id: "1", esito: "rifiutato", testo: "il modello non esiste." }), "Non inviato: il modello non esiste.");
  assert.equal(motivoNonInviato({ id: "1", esito: "rifiutato", testo: "" }), "Non inviato: il motore l'ha rifiutato.");
  assert.equal(motivoNonInviato({ id: null, esito: "non_scritto", testo: "disco pieno" }), "Non inviato: il messaggio non si è potuto scrivere.");
});

test("trascrizione Claude Code: permissionMode e token del contesto arrivano nella sessione", () => {
  const home = cartella(), id = "cccccccc-0000-4000-8000-000000000003";
  const riga = (o: object) => JSON.stringify(o);
  scrivi(path.join(home, ".claude", "projects", "p", `${id}.jsonl`), [
    riga({ type: "user", cwd: "/x/app", permissionMode: "acceptEdits", message: { role: "user", content: "ciao" }, timestamp: "2026-10-22T10:00:00Z" }),
    riga({ type: "assistant", cwd: "/x/app", message: { role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "ok" }], usage: { input_tokens: 2, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 24_000, output_tokens: 9 } }, timestamp: "2026-10-22T10:00:05Z" }),
  ].join("\n") + "\n");
  const s = leggiElenco({ home, env: {}, ora: Date.parse("2026-10-22T11:00:00Z") }).sessioni.find((x) => x.id === id)!;
  assert.equal(s.permessi, "acceptEdits");
  assert.equal(s.contesto, 124_002);
  assert.equal(percentoContesto(s.contesto, 200_000), 62);
});

test("modelli del motore: si legge modelli.json (lista o {modelli}), le voci storte si scartano, senza file null", () => {
  const home = cartella(), file = path.join(home, ".claude", "hooks", "friday", "modelli.json");
  assert.equal(leggiModelli(home), null);
  scrivi(file, "non è json");
  assert.equal(leggiModelli(home), null);
  const voci = [{ modello: "claude-opus-5-5", sforzi: ["low", "max", 3], rapida: true, contesto_max: 1_000_000, sforzo_default: "high" }, { modello: "claude-haiku-5-5", sforzi: [] }, { sforzi: ["low"] }, "x"];
  const attese = [{ modello: "claude-opus-5-5", sforzi: ["low", "max"], rapida: true, contesto_max: 1_000_000, sforzo_default: "high" }, { modello: "claude-haiku-5-5", sforzi: [] }];
  scrivi(file, JSON.stringify(voci));
  assert.deepEqual(leggiModelli(home), attese);
  scrivi(file, JSON.stringify({ modelli: voci }));
  assert.deepEqual(leggiModelli(home), attese);
  scrivi(file, "[]");
  assert.equal(leggiModelli(home), null);
});

test("modelli del menu: senza catalogo la lista fissa; col catalogo i principali in ordine e gli altri a parte; impegni e veloce per modello", () => {
  assert.deepEqual(modelliMenu(null).principali.map((m) => m.etichetta), ["Opus 5.5", "Fable 5.1", "Sonnet 5.5", "Haiku 5.5"]);
  assert.deepEqual(modelliMenu(null).altri, []);
  assert.equal(sforziDi(null, "claude-opus-5-5").length, 5);
  assert.equal(haRapida(null, "claude-opus-5-5"), true);
  const cat = [{ modello: "claude-opus-4-1", sforzi: [] }, { modello: "claude-sonnet-5-5" }, { modello: "claude-opus-5-5", sforzi: ["low", "max"], rapida: true }];
  const m = modelliMenu(cat);
  assert.deepEqual(m.principali.map((x) => x.etichetta), ["Opus 5.5", "Sonnet 5.5"]);
  assert.deepEqual(m.altri.map((x) => x.etichetta), ["Opus 4.1"]);
  assert.deepEqual(sforziDi(cat, "claude-opus-5-5").map((x) => x.etichetta), ["Basso", "Massimo"]);
  assert.equal(sforziDi(cat, "claude-sonnet-5-5").length, 5); // il catalogo non dice gli sforzi: i cinque livelli
  assert.deepEqual(sforziDi(cat, "claude-opus-4-1"), []); // nessuno sforzo: niente «Impegno»
  assert.deepEqual([haRapida(cat, "claude-opus-5-5"), haRapida(cat, "claude-sonnet-5-5"), haRapida(cat, "claude-opus-5-5-20261001")], [true, false, true]);
  assert.equal(sforzoDi(undefined, "high").id, "high"); // il predefinito del modello
  assert.equal(sforzoDi({ sforzo: "max" }, "high").id, "max");
});
