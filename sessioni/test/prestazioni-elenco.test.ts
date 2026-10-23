// Lavoro ripetuto (#456): elenco, indice, ricerca, osservatore. Conta le aperture dei file con un fs.openSync intercettato.
import { strict as assert } from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { leggiElenco } from "../src/elenco";
import { aggiornaVoce, cerca, Indice, type DatiIndice } from "../src/indice";
import { Osservatore } from "../src/osserva";

const fs = require("node:fs"); // quello vero: `import * as` ne darebbe una copia senza scrittura
const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const iso = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 60_000).toISOString();
const scrivi = (f: string, righe: unknown[]) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, righe.map((r) => JSON.stringify(r)).join("\n") + "\n"); };

const claude = (home: string, n: number, testo = `domanda ${n}`, radice = ".claude") => {
  const f = path.join(home, radice, "projects", "-Users-x-p", `${U(n)}.jsonl`);
  scrivi(f, [{ type: "user", sessionId: U(n), cwd: "/Users/x/p", message: { role: "user", content: testo }, timestamp: iso(n) },
    { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: `risposta ${testo}` }] }, timestamp: iso(n + 1) }]);
  return f;
};
const codex = (home: string, n: number, titolo = `compito ${n}`) => {
  const f = path.join(home, ".codex", "sessions", "2026", "10", "01", `rollout-2026-10-01T00-00-00-${U(n)}.jsonl`);
  scrivi(f, [{ type: "session_meta", payload: { id: U(n), cwd: "/Users/x/c", git: { branch: "dev" } } },
    { type: "event_msg", payload: { type: "user_message", message: titolo }, timestamp: iso(n) }]);
  return f;
};
const cursor = (home: string, n: number, testo = `idea ${n}`) => {
  const f = path.join(home, ".cursor", "projects", "Users-x-q", "agent-transcripts", U(n), `${U(n)}.jsonl`);
  scrivi(f, [{ role: "user", message: { content: [{ type: "text", text: `<user_query>${testo}</user_query>` }] } }]);
  return f;
};

/** Conta le aperture (e i byte letti) dei file il cui percorso passa il filtro, mentre gira `fn`. */
function conta<T>(fn: () => T, filtro: (p: string) => boolean = () => true): { aperti: string[]; byte: number; ms: number; r: T } {
  const { openSync, readSync, readFileSync } = fs;
  const aperti: string[] = [], fdPercorso = new Map<number, string>();
  let byte = 0;
  fs.openSync = (p: any, ...a: any[]) => { const fd = openSync(p, ...a); if (filtro(String(p))) { aperti.push(String(p)); fdPercorso.set(fd, String(p)); } return fd; };
  fs.readSync = (fd: number, ...a: any[]) => { const n = readSync(fd, ...a); if (fdPercorso.has(fd)) byte += n; return n; };
  fs.readFileSync = (p: any, ...a: any[]) => { const r = readFileSync(p, ...a); if (typeof p === "string" && filtro(p)) { aperti.push(p); byte += Buffer.byteLength(r); } return r; };
  const t0 = performance.now();
  try { const r = fn(); return { aperti, byte, ms: performance.now() - t0, r }; } finally { Object.assign(fs, { openSync, readSync, readFileSync }); }
}
const jsonl = (p: string) => p.endsWith(".jsonl");
const casa = () => fs.mkdtempSync(path.join(os.tmpdir(), "perf-elenco-"));
const elenco = (home: string) => leggiElenco({ home, env: {}, ora: Date.parse("2026-10-02T00:00:00Z") });
const per = (home: string, id: string) => elenco(home).sessioni.find((s) => s.id === id);

test("elenco: Codex e Cursor invariati non si rileggono al giro dopo", () => {
  const h = casa();
  codex(h, 1); cursor(h, 2); claude(h, 3);
  assert.equal(conta(() => elenco(h), jsonl).aperti.length, 3);
  assert.deepEqual(conta(() => elenco(h), jsonl).aperti, []);
});

test("elenco: un file Codex/Cursor cambiato (append, troncato, sostituito, stessa misura e mtime) si rilegge subito", () => {
  const h = casa();
  const fc = codex(h, 1, "primo"), fu = cursor(h, 2, "uno");
  assert.equal(per(h, U(1))!.titolo, "primo");
  // append: la coda cresce
  fs.appendFileSync(fc, JSON.stringify({ type: "turn_context", payload: { model: "gpt-nuovo", cwd: "/Users/x/c" } }) + "\n");
  assert.equal(per(h, U(1))!.modello, "gpt-nuovo");
  // troncato e riscritto più corto
  scrivi(fc, [{ type: "session_meta", payload: { id: U(1), cwd: "/Users/x/c" } }, { type: "event_msg", payload: { type: "user_message", message: "corto" } }]);
  assert.equal(per(h, U(1))!.titolo, "corto");
  assert.equal(per(h, U(1))!.modello, null);
  // sostituito con un altro file della stessa misura e dello stesso mtime (rename atomico): cambia l'inode
  const st = fs.statSync(fu), nuovo = `${fu}.n`;
  scrivi(nuovo, [{ role: "user", message: { content: [{ type: "text", text: "<user_query>due</user_query>" }] } }]);
  assert.equal(fs.statSync(nuovo).size, st.size);
  fs.utimesSync(nuovo, st.atime, st.mtime);
  fs.renameSync(nuovo, fu);
  assert.equal(per(h, U(2))!.titolo, "due");
  // riscritto sul posto con la stessa misura e riportato allo stesso mtime: cambia solo ctime
  const st2 = fs.statSync(fu), buf = fs.readFileSync(fu, "utf8").replace("due", "tre");
  fs.writeFileSync(fu, buf);
  fs.utimesSync(fu, st2.atime, st2.mtime);
  assert.equal(per(h, U(2))!.titolo, "tre");
});

test("elenco: radice aggiunta o tolta, file cancellato o spostato: nessuna voce fantasma", () => {
  const h = casa();
  claude(h, 1); const fc = codex(h, 2); cursor(h, 3);
  assert.equal(elenco(h).sessioni.length, 3);
  claude(h, 4, "altro account", ".claude-lavoro");
  assert.deepEqual(elenco(h).sessioni.map((s) => s.id).sort(), [U(1), U(2), U(3), U(4)]);
  fs.rmSync(path.join(h, ".claude-lavoro"), { recursive: true });
  fs.rmSync(fc);
  fs.renameSync(path.join(h, ".cursor", "projects", "Users-x-q"), path.join(h, "fuori"));
  assert.deepEqual(elenco(h).sessioni.map((s) => s.id), [U(1)]);
  // lo stesso file tornato com'era: si rilegge, non resta la copia in memoria
  codex(h, 2, "tornato");
  assert.equal(per(h, U(2))!.titolo, "tornato");
});

const sess = (id: string, file: string, titolo = "t") => ({ id, file, sorgente: "claude-code" as const, titolo });

test("indice: una trascrizione invariata non si rilegge; rinominata/spostata con lo stesso contenuto nemmeno", () => {
  const h = casa(), f = claude(h, 1, "gatto nero");
  const d: DatiIndice = {};
  assert.equal(conta(() => aggiornaVoce(d, sess("a", f)), jsonl).aperti.length, 1);
  assert.deepEqual(conta(() => aggiornaVoce(d, sess("a", f)), jsonl).aperti, []);
  const st = fs.statSync(f), g = path.join(h, ".claude", "projects", "-Users-x-p", "spostata.jsonl");
  fs.renameSync(f, g); // `mv` tra due account tiene mtime e dimensione
  const c = conta(() => aggiornaVoce(d, sess("a", g)), jsonl);
  assert.deepEqual([c.aperti, c.r, d.a.file, d.a.size], [[], true, g, st.size]);
  assert.equal(cerca(d, "gatto")[0].id, "a");
});

test("indice: append legge solo la coda, ma il risultato è quello di una lettura intera; troncato e cancellato aggiornano la voce", () => {
  const h = casa(), f = claude(h, 1, "primo");
  for (let i = 0; i < 5000; i++) fs.appendFileSync(f, JSON.stringify({ type: "user", message: { role: "user", content: `riga ${i} ${"z".repeat(400)}` } }) + "\n");
  const d: DatiIndice = {}, memo = new Map();
  aggiornaVoce(d, sess("a", f), memo);
  const size = fs.statSync(f).size;
  fs.appendFileSync(f, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "ultima parola" }] } }) + "\n");
  const c = conta(() => aggiornaVoce(d, sess("a", f), memo), jsonl);
  assert.ok(c.byte < size / 10, `letti ${c.byte} su ${size}`); // testa e ultimi blocchi verificati, il parse solo sulla coda
  const intera: DatiIndice = {};
  aggiornaVoce(intera, sess("a", f));
  assert.deepEqual(d.a, intera.a);
  // una riga a metà in fondo non conta finché non si chiude
  fs.appendFileSync(f, '{"type":"user","message":{"role":"user","content":"met');
  aggiornaVoce(d, sess("a", f), memo);
  assert.equal(d.a.conteggio, intera.a.conteggio);
  fs.appendFileSync(f, 'à"}}\n');
  aggiornaVoce(d, sess("a", f), memo);
  assert.equal(d.a.conteggio, intera.a.conteggio + 1);
  assert.equal(d.a.testi.at(-1)!.testo, "metà");
  // troncato e riscritto più piccolo, poi più grande ma diverso: nessuna coda attaccata al vecchio
  claude(h, 1, "nuovo contenuto");
  aggiornaVoce(d, sess("a", f), memo);
  assert.deepEqual(d.a.testi.map((x) => x.testo), ["nuovo contenuto", "risposta nuovo contenuto"]);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replaceAll("nuovo", "vecchi") + JSON.stringify({ type: "user", message: { role: "user", content: "e ancora" } }) + "\n");
  aggiornaVoce(d, sess("a", f), memo);
  assert.deepEqual(d.a.testi.map((x) => x.testo), ["vecchi contenuto", "risposta vecchi contenuto", "e ancora"]);
  fs.rmSync(f);
  assert.equal(aggiornaVoce(d, sess("a", f), memo), true);
  assert.equal(d.a, undefined);
  assert.equal(memo.size, 0);
});

test("indice: la memoria della lettura incrementale è limitata", () => {
  const h = casa(), d: DatiIndice = {}, memo = new Map();
  for (let i = 0; i < 100; i++) aggiornaVoce(d, sess(`s${i}`, claude(h, i)), memo);
  assert.ok(memo.size <= 32, `memo ${memo.size}`);
});

test("Indice: i giri di metti() usano la memoria delle letture; ricostruisci la azzera", async () => {
  const h = casa(), f = claude(h, 1, "alfa");
  const i = new Indice(path.join(h, "ud"), 60_000);
  await i.metti([sess("a", f)], true);
  fs.appendFileSync(f, JSON.stringify({ type: "user", message: { role: "user", content: "beta" } }) + "\n");
  const p = i.metti([sess("a", f)]);
  await p;
  assert.deepEqual(i.dati.a.testi.map((x) => x.testo), ["alfa", "risposta alfa", "beta"]);
  assert.equal((i as any).memo.size, 1);
  await i.ricostruisci([sess("a", f)]);
  assert.deepEqual(i.dati.a.testi.length, 3);
  i.svuota();
  assert.equal((i as any).memo.size, 0);
});

test("ricerca: stesso testo in due sessioni le dà entrambe; input malformato non lancia", () => {
  const h = casa(), d: DatiIndice = {};
  aggiornaVoce(d, sess("a", claude(h, 1, "gatto uguale")));
  aggiornaVoce(d, sess("b", claude(h, 2, "gatto uguale")));
  assert.deepEqual(cerca(d, "gatto uguale").map((r) => r.id).sort(), ["a", "b"]);
  const strani = ["", " ", "\t\n", "x".repeat(10_000), "\u0000\u0001\u001b[31m", ".*", "(", "[a-", "\\", "a|b", "$^", "İ", "\ud800", "👍".repeat(5000)];
  for (const q of strani) assert.doesNotThrow(() => cerca(d, q), JSON.stringify(q.slice(0, 20)));
  assert.deepEqual(cerca(d, ".*"), []); // testo, non regex
  assert.deepEqual(cerca(d, "x".repeat(10_000)), []);
  const i = new Indice(path.join(h, "ud"));
  for (const q of strani) assert.doesNotThrow(() => i.cerca(q));
});

test("indice: ricerca con maiuscole speciali (İ) ritaglia il frammento dal punto giusto", () => {
  const d: DatiIndice = { a: { file: "x.jsonl", mtime: 1, size: 1, titolo: "t", conteggio: 1, testi: [{ testo: "İİİİİ ".repeat(20) + "ago nel pagliaio", t: 1 }] } };
  const r = cerca(d, "ago nel");
  assert.ok(r[0].frammento.includes("ago nel"), r[0].frammento);
});

test("osservatore: un giro senza cambi non apre trascrizioni; una radice nuova viene guardata", () => {
  const h = casa();
  for (let i = 0; i < 20; i++) { claude(h, i); if (i % 2) codex(h, 100 + i); if (i % 3) cursor(h, 200 + i); }
  const o = new Osservatore(h, () => {}, {}, 20);
  try {
    o.avvia();
    o.giro();
    const c = conta(() => o.giro(), jsonl);
    assert.deepEqual(c.aperti, []);
    const prima = (o as any).watchers.size;
    claude(h, 500, "nuovo account", ".claude-nuovo");
    o.giro();
    assert.ok(o.elenco.sessioni.some((s) => s.id === U(500)));
    assert.equal((o as any).watchers.size, prima + 1, "la radice nuova ha il suo osservatore");
    fs.rmSync(path.join(h, ".claude-nuovo"), { recursive: true });
    o.giro();
    assert.ok(!o.elenco.sessioni.some((s) => s.id === U(500)));
    for (const f of (o as any).offset.keys()) assert.ok(o.elenco.sessioni.some((s) => s.file === f), `offset orfano ${f}`);
  } finally { o.ferma(); }
});

test("misure (stampate, nessun limite): avvio con 2000 sessioni, memoria, giro inattivo, ricerca grande, append su file grande", () => {
  const N = Number(process.env.CLOTCH_PERF_N ?? 2000), h = casa(), mb = () => { (global as any).gc?.(); return +(process.memoryUsage().heapUsed / 1048576).toFixed(1); };
  for (let i = 0; i < N; i++) { if (i % 2 === 0) claude(h, i); else if (i % 4 === 1) codex(h, i); else cursor(h, i); }
  const stampa = (nome: string, o: object) => console.log(`MISURA ${nome} ${JSON.stringify(o)}`);
  const m0 = mb();
  const freddo = conta(() => elenco(h), jsonl), caldo = conta(() => elenco(h), jsonl), lista = caldo.r.sessioni;
  stampa("elenco", { sessioni: lista.length, freddoMs: +freddo.ms.toFixed(1), freddoAperti: freddo.aperti.length, caldoMs: +caldo.ms.toFixed(1), caldoAperti: caldo.aperti.length, caldoByte: caldo.byte, heapMB: +(mb() - m0).toFixed(1) });
  const d: DatiIndice = {}, memo = new Map(), m1 = mb();
  const primo = conta(() => lista.forEach((s) => aggiornaVoce(d, s, memo)), jsonl), secondo = conta(() => lista.forEach((s) => aggiornaVoce(d, s, memo)), jsonl);
  stampa("indice", { voci: Object.keys(d).length, primoMs: +primo.ms.toFixed(1), primoByte: primo.byte, secondoMs: +secondo.ms.toFixed(1), secondoAperti: secondo.aperti.length, heapMB: +(mb() - m1).toFixed(1) });
  const o = new Osservatore(h, () => {}, {}, 20);
  o.giro();
  const g = conta(() => o.giro(), jsonl), g2 = conta(() => o.giro(), jsonl);
  stampa("osservatore-inattivo", { giroMs: +g.ms.toFixed(1), giroAperti: g.aperti.length, giroByte: g.byte, secondoGiroMs: +g2.ms.toFixed(1) });
  const grande: DatiIndice = {}, testo = (k: number) => `parola${k} ` + "lorem ipsum dolor sit amet ".repeat(8);
  for (let i = 0; i < N; i++) grande[`s${i}`] = { file: "x.jsonl", mtime: i, size: 1, titolo: `titolo ${i}`, conteggio: 100, testi: Array.from({ length: 50 }, (_, k) => ({ testo: testo(i * 50 + k), t: k })) };
  const q = (t: string) => { const r = conta(() => cerca(grande, t)); return { ms: +r.ms.toFixed(1), trovate: r.r.length }; };
  stampa("ricerca", { sessioni: N, testi: N * 50, senzaRisultato: q("zzzzqqq"), rara: q(`parola${N * 25}`), comune: q("lorem") });
  const f = claude(h, 99999), riga = JSON.stringify({ type: "user", message: { role: "user", content: "k".repeat(1000) } }) + "\n";
  fs.appendFileSync(f, riga.repeat(8000)); // ~8 MB
  const dg: DatiIndice = {}, mg = new Map(), s = sess("g", f);
  aggiornaVoce(dg, s, mg);
  fs.appendFileSync(f, riga);
  const a = conta(() => aggiornaVoce(dg, s, mg), jsonl);
  stampa("append-8MB", { size: fs.statSync(f).size, ms: +a.ms.toFixed(1), byteLetti: a.byte, voce: dg.g.conteggio });
  assert.equal(dg.g.conteggio, 8003);
});
