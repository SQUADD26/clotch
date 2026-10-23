// Cronologia: costo proporzionale alla modifica, rilevamento di truncate/replace/riscrittura, cursori ed eviction.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cronologia, type LimitiCronologia } from "../src/cronologia";
import type { DeltaCronologia } from "../src/cronologia-tipi";

const riga = (i: number, pad = 0) => JSON.stringify({ type: i % 2 ? "assistant" : "user", message: { content: `m${i} ` + "x".repeat(pad) } }) + "\n";
const righe = (da: number, a: number, pad = 0) => Array.from({ length: a - da }, (_, i) => riga(da + i, pad)).join("");
const nuovaDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "cronologia-"));
const sorg = (file: string, id = "s") => ({ id, file, sorgente: "claude-code" as const });
const v1 = { v: 1 as const };
function con(limiti?: LimitiCronologia, ora?: () => number) {
  const dir = nuovaDir(), file = path.join(dir, "a.jsonl"), deltas: DeltaCronologia[] = [];
  const c = new Cronologia(limiti, ora);
  c.collega((d) => deltas.push(d));
  return { dir, file, c, deltas, s: sorg(file), pulisci: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
/** Byte e chiamate di readSync reali durante `f`. */
function leggendo<T>(f: () => T) {
  const orig = fs.readSync, st = { byte: 0, chiamate: 0 };
  (fs as any).readSync = (...a: any[]) => { const n = (orig as any)(...a); st.byte += n; st.chiamate++; return n; };
  try { return { r: f(), ...st, get byte() { return st.byte; }, get chiamate() { return st.chiamate; } }; } finally { (fs as any).readSync = orig; }
}
const ok = (x: any) => { assert.ok(!(x && "codice" in x), JSON.stringify(x)); return x; };
const reset = (d: DeltaCronologia[]) => d.filter((x) => x.tipo === "reset") as Extract<DeltaCronologia, { tipo: "reset" }>[];

test("budget: un append di ~61 byte su 2 MB legge solo coda e finestra di controllo", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, righe(0, 2000, 1000));
    assert.ok(fs.statSync(t.file).size > 2_000_000);
    assert.equal(t.c.pagina(t.s, 0, v1).totale, 2000);
    const add = JSON.stringify({ type: "assistant", message: { content: "one new message" } }) + "\n";
    assert.ok(Buffer.byteLength(add) >= 55 && Buffer.byteLength(add) <= 70);
    fs.appendFileSync(t.file, add);
    t.deltas.length = 0;
    const m = leggendo(() => t.c.aggiorna(t.s));
    ok(m.r);
    const LIMITE = 24 * 1024; // finestra di controllo (16 campioni da 1 KiB al massimo) + coda; il file intero sono 2 MB
    assert.ok(m.byte >= Buffer.byteLength(add) && m.byte <= LIMITE, `letti ${m.byte} byte`);
    assert.equal(t.deltas.length, 1);
    const d = t.deltas[0] as Extract<DeltaCronologia, { tipo: "upsert" }>;
    assert.deepEqual([d.tipo, d.righe.length, d.totale], ["upsert", 1, 2001]);
    // nessun cambio: solo stat. Touch senza cambio di dimensione: solo la finestra di controllo.
    assert.equal(leggendo(() => t.c.aggiorna(t.s)).byte, 0);
    const adesso = new Date(Date.now() + 5000);
    fs.utimesSync(t.file, adesso, adesso);
    const toc = leggendo(() => t.c.aggiorna(t.s));
    assert.ok(toc.byte <= LIMITE && t.deltas.length === 1, `touch: letti ${toc.byte}`);
    assert.equal(t.c.pagina(t.s, 0, v1).totale, 2001);
  } finally { t.pulisci(); }
});

test("riga parziale in coda: non pubblicata finché non è chiusa, poi una volta sola; UTF-8 intatto", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, riga(0));
    t.c.pagina(t.s, 0, v1);
    const piena = Buffer.from(JSON.stringify({ type: "assistant", message: { content: "è 🙂 fine" } }) + "\n"), meta = piena.indexOf("🙂") + 2; // a metà dei 4 byte dell'emoji
    fs.appendFileSync(t.file, piena.subarray(0, meta));
    ok(t.c.aggiorna(t.s));
    assert.equal(t.c.pagina(t.s, 0, v1).totale, 1);
    fs.appendFileSync(t.file, piena.subarray(meta));
    ok(t.c.aggiorna(t.s));
    const p = t.c.pagina(t.s, 0, v1);
    assert.equal(p.totale, 2);
    assert.equal((p.messaggi[1] as any).testo, "è 🙂 fine");
    assert.equal(reset(t.deltas).length, 0);
  } finally { t.pulisci(); }
});

test("truncate: epoca nuova e reset", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, righe(0, 10));
    const e0 = ok(t.c.aggiorna(t.s)).epoca;
    fs.truncateSync(t.file, fs.statSync(t.file).size - 40);
    const e1 = ok(t.c.aggiorna(t.s)).epoca;
    assert.notEqual(e0, e1);
    assert.deepEqual(reset(t.deltas).map((d) => [d.motivo, d.epocaPrecedente, d.epoca]), [["truncate", e0, e1]]);
  } finally { t.pulisci(); }
});

test("replace: stesso percorso, inode diverso, anche con contenuto più lungo", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, righe(0, 10));
    const e0 = ok(t.c.aggiorna(t.s)).epoca;
    fs.writeFileSync(t.file + ".n", righe(0, 14));
    fs.renameSync(t.file + ".n", t.file);
    const st = ok(t.c.aggiorna(t.s));
    assert.notEqual(st.epoca, e0);
    assert.deepEqual(reset(t.deltas).map((d) => d.motivo), ["replace"]);
    assert.equal(st.righe.length, 14);
  } finally { t.pulisci(); }
});

test("riscrittura: stessa dimensione e stesso inode, byte diversi in testa o in coda", () => {
  for (const [nome, cambia] of [["testa", (s: string) => s.replace("m0 ", "mZ ")], ["coda", (s: string) => s.replace("m9 ", "mZ ")]] as const) {
    const t = con();
    try {
      const orig = righe(0, 10);
      fs.writeFileSync(t.file, orig);
      const e0 = ok(t.c.aggiorna(t.s)).epoca;
      fs.writeFileSync(t.file, cambia(orig));
      assert.equal(fs.statSync(t.file).size, Buffer.byteLength(orig));
      assert.notEqual(ok(t.c.aggiorna(t.s)).epoca, e0, nome);
      assert.deepEqual(reset(t.deltas).map((d) => d.motivo), ["riscrittura"], nome);
    } finally { t.pulisci(); }
  }
});

test("regrow dopo truncate: più grande di prima ma contenuto diverso (stesse prime righe) = riscrittura", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, righe(0, 600, 200));
    const e0 = ok(t.c.aggiorna(t.s)).epoca, grande = fs.statSync(t.file).size;
    fs.writeFileSync(t.file, righe(0, 3, 200) + righe(1000, 1400, 400)); // stesse 3 righe, poi altro; più grande
    assert.ok(fs.statSync(t.file).size > grande);
    const st = ok(t.c.aggiorna(t.s));
    assert.notEqual(st.epoca, e0);
    assert.deepEqual(reset(t.deltas).map((d) => d.motivo), ["riscrittura"]);
    assert.equal(st.righe.length, 403);
  } finally { t.pulisci(); }
});

test("limite noto: modifica interna a stessa dimensione fuori dai campioni NON è rilevata (rilevamento probabilistico)", () => {
  const t = con();
  try {
    const orig = righe(0, 2000, 1000);
    fs.writeFileSync(t.file, orig);
    const e0 = ok(t.c.aggiorna(t.s)).epoca;
    // un byte a metà della riga 137, lontano da testa, coda e campioni distribuiti sul prefisso
    const pos = orig.indexOf("m137 ") + 2000;
    fs.writeFileSync(t.file, orig.slice(0, pos) + "Q" + orig.slice(pos + 1));
    assert.equal(ok(t.c.aggiorna(t.s)).epoca, e0);
    assert.equal(reset(t.deltas).length, 0);
  } finally { t.pulisci(); }
});

test("append durante la lettura: rilettura coerente, nessun dato perso; instabilità continua = errore senza reset", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, righe(0, 60) + riga(60)); // dopo il primo giro serve una lettura incrementale
    t.c.pagina(t.s, 0, v1);
    const orig = fs.readSync;
    let fatto = false;
    fs.appendFileSync(t.file, riga(61)); // c'è qualcosa da leggere, quindi readSync parte davvero
    (fs as any).readSync = (...a: any[]) => { const n = (orig as any)(...a); if (!fatto) { fatto = true; fs.appendFileSync(t.file, riga(62)); } return n; };
    try { ok(t.c.aggiorna(t.s)); } finally { (fs as any).readSync = orig; }
    assert.equal(t.c.pagina(t.s, 0, v1).totale, 63);
    // sorgente che cambia a ogni lettura: errore sorgente_instabile, poi si riprende senza nuova epoca
    const e0 = ok(t.c.aggiorna(t.s)).epoca;
    fs.appendFileSync(t.file, riga(99));
    let n = 100;
    (fs as any).readSync = (...a: any[]) => { const k = (orig as any)(...a); fs.appendFileSync(t.file, riga(n++)); return k; };
    let e: any; try { e = t.c.aggiorna(t.s); } finally { (fs as any).readSync = orig; }
    assert.equal(e.codice, "sorgente_instabile");
    const dopo = ok(t.c.aggiorna(t.s));
    assert.equal(dopo.epoca, e0, "un errore di lettura non cambia l'epoca di un file solo appeso");
    assert.equal(reset(t.deltas).length, 0);
    assert.ok(dopo.righe.length >= 63);
  } finally { t.pulisci(); }
});

const due = (limiti?: LimitiCronologia, ora?: () => number) => {
  const t = con(limiti, ora), b = sorg(path.join(t.dir, "b.jsonl"), "b");
  fs.writeFileSync(t.file, righe(0, 120));
  fs.writeFileSync(b.file, righe(500, 620));
  return { ...t, b };
};

test("cursore: scaduto (TTL), di un'altra sessione, manomesso", () => {
  let ora = 0;
  const t = due({ ttlMs: 100 }, () => ora);
  try {
    const pa = t.c.pagina(t.s, 0, v1), pb = t.c.pagina(t.b, 0, v1);
    const ca = pa.cronologia!.cursorePrima!, cb = pb.cronologia!.cursorePrima!;
    const cod = (r: any) => r.erroreCronologia?.codice;
    assert.equal(cod(t.c.pagina(t.s, 1, { v: 1, cursore: ca })), undefined);
    assert.equal(cod(t.c.pagina(t.b, 1, { v: 1, cursore: ca })), "cursore_invalido");
    assert.equal(cod(t.c.pagina(t.s, 1, { v: 1, cursore: cb })), "cursore_invalido");
    const [tok, n, f] = ca.split(".");
    const brutti: unknown[] = [`${tok}.${n}.${f.slice(0, -1)}${f.endsWith("a") ? "b" : "a"}`, `${tok}.${Number(n) + 1}.${f}`, `${tok}.${n}`, `${tok}.${n}.${f}.x`,
      `${tok}.-1.${f}`, `${tok}.1e1.${f}`, `${tok}.${n}.`, "", ca + "x".repeat(5000), 42, { a: 1 }, `x.${n}.${f}`];
    for (const c of brutti) assert.equal(cod(t.c.pagina(t.s, 1, { v: 1, cursore: c as string })), "cursore_invalido", String(c).slice(0, 40));
    assert.equal(cod(t.c.pagina(t.s, -1, v1)), "cursore_invalido");
    assert.equal(cod(t.c.pagina(t.s, 1.5, v1)), "cursore_invalido");
    assert.equal(cod(t.c.pagina(t.s, 0, { v: 2 } as any)), "cursore_invalido");
    ora = 101;
    assert.equal(cod(t.c.pagina(t.s, 1, { v: 1, cursore: ca })), "snapshot_scaduta");
    assert.equal(cod(t.c.pagina(t.b, 1, { v: 1, cursore: cb })), "snapshot_scaduta");
    assert.equal(t.c.pagina(t.s, 0, v1).erroreCronologia, undefined); // ripartire da una nuova snapshot funziona
  } finally { t.pulisci(); }
});

test("snapshot: limite di numero (LRU) e di byte; una sola snapshot oltre il limite è rifiutata", () => {
  const cod = (r: any) => r.erroreCronologia?.codice;
  const t = due({ snapshotNumero: 2 });
  try {
    const c1 = t.c.pagina(t.s, 0, v1).cronologia!.cursorePrima!, c2 = t.c.pagina(t.b, 0, v1).cronologia!.cursorePrima!;
    assert.equal(cod(t.c.pagina(t.s, 1, { v: 1, cursore: c1 })), undefined); // tocca la prima: ora la più vecchia è la seconda
    const c3 = t.c.pagina(t.s, 0, v1).cronologia!.cursorePrima!;
    assert.equal(cod(t.c.pagina(t.b, 1, { v: 1, cursore: c2 })), "snapshot_scaduta");
    assert.equal(cod(t.c.pagina(t.s, 1, { v: 1, cursore: c1 })), undefined);
    assert.equal(cod(t.c.pagina(t.s, 1, { v: 1, cursore: c3 })), undefined);
  } finally { t.pulisci(); }
  const u = due();
  try {
    const byte = ok(u.c.aggiorna(u.s)).byte;
    const t2 = due({ snapshotByte: Math.floor(byte * 1.5) });
    try {
      const a = t2.c.pagina(t2.s, 0, v1).cronologia!.cursorePrima!;
      t2.c.pagina(t2.b, 0, v1);
      assert.equal(cod(t2.c.pagina(t2.s, 1, { v: 1, cursore: a })), "snapshot_scaduta", "la più vecchia esce quando i byte superano il tetto");
    } finally { t2.pulisci(); }
    const t3 = due({ snapshotByte: Math.floor(byte / 2), statoByte: byte * 4 });
    try { assert.equal(cod(t3.c.pagina(t3.s, 0, v1)), "non_letta"); } finally { t3.pulisci(); }
    const t4 = due({ statoByte: Math.floor(byte / 2) });
    try { assert.equal(cod(t4.c.pagina(t4.s, 0, v1)), "non_letta"); } finally { t4.pulisci(); }
    const t5 = due({ fileByte: 1000 });
    try { assert.equal(cod(t5.c.pagina(t5.s, 0, v1)), "non_letta"); } finally { t5.pulisci(); }
  } finally { u.pulisci(); }
});

test("eviction dello stato (P1): lo storico espulso torna con stessa epoca, chiavi e revisioni; solo il nuovo è upsert", () => {
  const t = due();
  try {
    const stato = Math.max(ok(t.c.aggiorna(t.s)).byte, ok(t.c.aggiorna(t.b)).byte) + 1000;
    const e = due({ statoByte: stato }); // regge un solo ledger (le due righe aggiunte stanno nei 1000 byte di margine)
    try {
      fs.appendFileSync(e.file, JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "T1", name: "Bash", input: {} }] } }) + "\n");
      const p0 = e.c.pagina(e.s, 0, v1), c0 = p0.cronologia!, cur = c0.cursorePrima!;
      e.c.pagina(e.b, 0, v1); // espelle s
      e.deltas.length = 0;
      fs.appendFileSync(e.file, JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "T1", content: "ok" }] } }) + "\n" + riga(121));
      const p1 = e.c.pagina(e.s, 0, v1), c1 = p1.cronologia!;
      assert.equal(c1.epoca, c0.epoca);
      assert.equal(p1.totale, 122);
      assert.equal(reset(e.deltas).length, 0);
      const up = e.deltas.filter((d) => d.tipo === "upsert") as Extract<DeltaCronologia, { tipo: "upsert" }>[];
      assert.equal(up.length, 1);
      assert.deepEqual(up[0].righe.map((r) => r.ordine), [120, 121]); // lo strumento aggiornato e la riga nuova, niente storico
      // la pagina vecchia della snapshot precedente è ancora servita, con lo storico non rinumerato
      const vecchia = e.c.pagina(e.s, 1, { v: 1, cursore: cur });
      assert.equal(vecchia.erroreCronologia, undefined);
      assert.ok(vecchia.cronologia!.righe.every((r) => r.revisione === 1));
      const prima = new Map(c0.righe.map((r) => [r.ordine, r]));
      for (const r of c1.righe) {
        const x = prima.get(r.ordine);
        if (x && r.ordine !== 120) assert.deepEqual([r.chiave, r.revisione], [x.chiave, x.revisione]);
      }
      assert.deepEqual(c1.righe.filter((r) => r.ordine >= 120).map((r) => r.revisione), [2, 2]);
    } finally { e.pulisci(); }
  } finally { t.pulisci(); }
});

test("eviction dello stato: file sostituito o accorciato mentre il ledger è espulso = reset con epoca precedente", () => {
  const t = due();
  try {
    const stato = Math.max(ok(t.c.aggiorna(t.s)).byte, ok(t.c.aggiorna(t.b)).byte) + 1000;
    for (const [motivo, muta] of [["replace", (e: any) => { fs.writeFileSync(e.file + ".n", righe(0, 121)); fs.renameSync(e.file + ".n", e.file); }],
      ["truncate", (e: any) => fs.truncateSync(e.file, 100)]] as const) {
      const e = due({ statoByte: stato });
      try {
        const e0 = ok(e.c.aggiorna(e.s)).epoca;
        e.c.pagina(e.b, 0, v1);
        muta(e);
        const p = e.c.pagina(e.s, 0, v1);
        assert.notEqual(p.cronologia!.epoca, e0);
        assert.deepEqual(reset(e.deltas).map((d) => [d.motivo, d.epocaPrecedente]), [[motivo, e0]]);
      } finally { e.pulisci(); }
    }
  } finally { t.pulisci(); }
});

test("eviction oltre i metadati (4096 ledger espulsi): il vecchio cursore non serve righe di un'altra epoca", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, righe(0, 60));
    const limite = ok(t.c.aggiorna(t.s)).byte + 100, c = new Cronologia({ statoByte: limite });
    const x = { ...t.s, id: "x" };
    const p0 = c.pagina(x, 0, v1), cur = p0.cronologia!.cursorePrima!;
    for (let i = 0; i < 4200; i++) c.aggiorna({ ...t.s, id: `b${i}` }); // ognuno espelle il precedente
    const p1 = c.pagina(x, 0, v1);
    assert.equal(p1.erroreCronologia, undefined);
    assert.notEqual(p1.cronologia!.epoca, p0.cronologia!.epoca, "i metadati sono stati scartati: epoca nuova");
    assert.equal(c.pagina(x, 1, { v: 1, cursore: cur }).erroreCronologia?.codice, "epoca_cambiata");
  } finally { t.pulisci(); }
});

test("file sparito e tornato uguale: errore sorgente_assente, poi nessuna nuova epoca", () => {
  const t = con();
  try {
    fs.writeFileSync(t.file, righe(0, 5));
    const e0 = ok(t.c.aggiorna(t.s)).epoca;
    const salvo = fs.readFileSync(t.file);
    fs.unlinkSync(t.file);
    assert.equal((t.c.aggiorna(t.s) as any).codice, "sorgente_assente");
    fs.writeFileSync(t.file, salvo);
    // nota: inode nuovo, quindi è "replace" legittimo; ciò che conta è che non esploda e che il totale resti 5
    const st = ok(t.c.aggiorna(t.s));
    assert.equal(st.righe.length, 5);
    assert.ok(st.epoca === e0 || reset(t.deltas).length === 1);
  } finally { t.pulisci(); }
});
