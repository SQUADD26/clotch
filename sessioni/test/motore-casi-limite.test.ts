// Casi limite del collegamento col motore Friday (#456): registro, obiettivi e passi, casella dei comandi, annulla.
// Solo HOME temporanee e una Friday finta: nessun motore vero (per quello: motore-integrato.test.ts).
import test from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro } from "../src/friday";
import { inviaComando } from "../src/comandi";
import { piano } from "../src/friday-ipc";

const casa = () => fs.mkdtempSync(path.join(os.tmpdir(), "motore-"));
const dirReg = (h: string) => path.join(h, ".claude", "registro");
const fileMese = (h: string, mese = "2026-10") => path.join(dirReg(h), `${mese}.jsonl`);
const casella = (h: string) => path.join(h, ".claude", "casella", "comandi");
let seq = 0;
const ev = (chat: string, tipo: string, dati: object = {}, extra: object = {}) =>
  ({ v: 1, id: `r-${String(++seq).padStart(12, "0")}`, t: new Date(Date.UTC(2026, 9, 23, 10, 0, seq)).toISOString(), n: seq, chat, macchina: "mac", hook_v: "x", tipo, dati, ...extra });
/** Aggiunge righe (oggetti o testo grezzo) al registro del mese. */
function scrivi(h: string, ...righe: (object | string)[]) {
  fs.mkdirSync(dirReg(h), { recursive: true });
  fs.appendFileSync(fileMese(h), righe.map((r) => (typeof r === "string" ? r : JSON.stringify(r)) + "\n").join(""));
}
const canon = (v: any): string => Array.isArray(v) ? `[${v.map(canon).join(", ")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}: ${canon(v[k])}`).join(", ")}}` : JSON.stringify(v);
/** Una decisione di Friday con la sua ricevuta locale (come `decidi`, per dati ASCII). */
function decisione(h: string, dati: object = {}, ricevuta = true) {
  const e = ev("friday", "decisione", { cosa: "Fermata la chat", perche: "test", inverso: ["python3", "x"], chat: "", genere: "fermo", non_annullabile: "", effetto_annullo: "riparte", ...dati });
  scrivi(h, e);
  if (ricevuta) {
    const d = path.join(h, ".claude", "friday", "eventi-locali", "decisione");
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, e.id), crypto.createHash("sha256").update(canon(e)).digest("hex"));
  }
  return e.id;
}
const annulla = (h: string, id: string, esito?: string, testo = "") => {
  const cid = `c-${String(++seq).padStart(12, "0")}`;
  scrivi(h, ev("friday", "comando", { id: cid, cmd: "annulla", da: "app", args: { decisione: id } }));
  if (esito) scrivi(h, ev("friday", "comando_fatto", { comando: cid, esito, testo }));
  return cid;
};

/** Una Friday finta: prende ogni comando dalla casella (in presi/), scrive `comando` e, dopo `ritardo` ms, `comando_fatto`. */
function fridayFinta(t: test.TestContext, h: string, risposta: (c: any) => { esito: string; testo: string } | null, ritardo = 0) {
  const visti = new Set<string>(), iv = setInterval(() => {
    let nomi: string[] = [];
    try { nomi = fs.readdirSync(casella(h)).filter((n) => n.endsWith(".json")); } catch {}
    for (const n of nomi.sort()) {
      if (visti.has(n)) continue;
      visti.add(n);
      const c = JSON.parse(fs.readFileSync(path.join(casella(h), n), "utf8"));
      fs.mkdirSync(path.join(casella(h), "presi"), { recursive: true });
      fs.renameSync(path.join(casella(h), n), path.join(casella(h), "presi", n));
      scrivi(h, ev("friday", "comando", c));
      const r = risposta(c);
      if (r) setTimeout(() => scrivi(h, ev("friday", "comando_fatto", { comando: c.id, ...r })), ritardo);
    }
  }, 5);
  t.after(() => clearInterval(iv));
}
const opz = { ogniMs: 10, scadenzaMs: 3000 };

test("registro mancante, vuoto o di sole righe vuote: registro vuoto, nessun errore", () => {
  const h = casa();
  assert.deepEqual([...leggiRegistro(h).chat], []);
  fs.mkdirSync(dirReg(h), { recursive: true });
  assert.equal(leggiRegistro(h).errori.length, 0);
  fs.writeFileSync(fileMese(h), "");
  fs.appendFileSync(fileMese(h), "\n\n  \n");
  const r = leggiRegistro(h);
  assert.deepEqual([r.chat.size, r.avvisi.length, r.decisioni.length, r.errori.length], [0, 0, 0, 0]);
});

test("registro illeggibile (cartella al posto del file, file al posto della cartella): un errore, le altre righe restano", () => {
  const h = casa();
  scrivi(h, ev("a", "stato", { stato: "lavora" }));
  fs.mkdirSync(fileMese(h, "2026-09")); // un mese che è una cartella
  const r = leggiRegistro(h);
  assert.equal(r.chat.get("a")?.stato, "lavora");
  assert.equal(r.errori.length, 1);
  const h2 = casa();
  fs.mkdirSync(path.join(h2, ".claude"));
  fs.writeFileSync(dirReg(h2), "non una cartella");
  assert.equal(leggiRegistro(h2).errori.length, 1);
});

test("righe corrotte, troncate, non oggetto o di versione futura: saltate, le buone restano", () => {
  const h = casa();
  scrivi(h, ev("a", "inizio", { titolo: "Prima" }), "{non json", "null", "42", '"testo"', "[1,2]", JSON.stringify({ ...ev("a", "stato", { stato: "bloccato" }), v: 2 }),
    JSON.stringify({ ...ev("a", "stato", { stato: "bloccato" }), v: "1" }), JSON.stringify({ v: 1, tipo: "stato", dati: {} }), JSON.stringify({ v: 1, chat: "a", dati: {} }),
    '{"v":1,"id":"r-x","chat":"a","tipo":"stato","dati":{"stato":"fin', // riga tagliata a metà: il prossimo scrittore la chiude con un a-capo
    ev("a", "stato", { stato: "lavora", dettaglio: "dopo i guasti" }));
  const r = leggiRegistro(h);
  assert.deepEqual([r.errori.length, r.chat.size, r.chat.get("a")?.titolo, r.chat.get("a")?.stato, r.chat.get("a")?.dettaglio], [0, 1, "Prima", "lavora", "dopo i guasti"]);
});

test("dati strani (stringa, lista, numero, null): nessuna eccezione, nessun campo inventato", () => {
  const h = casa();
  for (const tipo of ["inizio", "stato", "battito", "richiesta", "passi", "obiettivo", "decisione", "avviso", "comando", "comando_fatto", "regola", "fermo", "coda", "impostazioni"])
    for (const dati of ["testo", [1, 2], 7, null, true]) scrivi(h, ev("z", tipo, dati as any));
  const r = leggiRegistro(h);
  assert.equal(r.errori.length, 0);
  assert.equal(r.chat.get("z")?.stato, null);
  assert.deepEqual(r.chat.get("z")?.passi, []);
  assert.equal(r.fermoTutto, false);
});

test("evento troncato dal produttore (oltre 60 KB): i passi di prima restano, la decisione non è annullabile", () => {
  const h = casa();
  scrivi(h, ev("a", "passi", { agente: "", passi: [{ testo: "Scrivere il test", stato: "in_progress", prova: "", tolto: false }] }));
  scrivi(h, ev("a", "passi", { troncato: true, inizio: '{"passi":[' }));
  const id = decisione(h, {});
  scrivi(h, ev("friday", "decisione", { troncato: true, inizio: "{" }, { id: "r-aaaaaaaaaaaa" }));
  const r = leggiRegistro(h);
  assert.deepEqual(r.chat.get("a")!.passi, [{ testo: "Scrivere il test", stato: "in_progress" }]);
  assert.deepEqual(r.decisioni.map((d) => [d.id === id, d.annullabile]), [[true, true], [false, false]]);
});

test("obiettivo: aperto, proposto, bloccato, raggiunto, rifiutato, passato; ogni chat ha il suo", () => {
  const h = casa();
  const o = (chat: string, stato: string, versione: number, testo = "Chiudere #456") => ev(chat, "obiettivo", { stato, testo, versione });
  scrivi(h, o("a", "proposto", 1), o("a", "aperto", 2), o("a", "bloccato", 3), o("b", "aperto", 1, "Altro"), o("a", "raggiunto", 4), o("b", "rifiutato", 2, "Altro"), o("c", "passato", 5));
  const r = leggiRegistro(h);
  assert.deepEqual([...r.chat].map(([k, c]) => [k, c.obiettivo]), [["a", { stato: "raggiunto", testo: "Chiudere #456" }], ["b", { stato: "rifiutato", testo: "Altro" }], ["c", { stato: "passato", testo: "Chiudere #456" }]]);
});

test("obiettivo: un evento vecchio (versione più bassa) arrivato in ritardo non riporta indietro lo stato", () => {
  const h = casa();
  const o = (stato: string, versione?: number) => ev("a", "obiettivo", { stato, testo: "T", ...(versione ? { versione } : {}) });
  // le righe remote in ritardo (friday_segui) entrano in fondo al file con la loro `t`: l'ordine del file non è quello delle versioni
  scrivi(h, o("aperto", 1), o("raggiunto", 3), o("aperto", 1));
  assert.equal(leggiRegistro(h).chat.get("a")!.obiettivo!.stato, "raggiunto");
  scrivi(h, o("raggiunto", 3), o("bloccato")); // stessa versione (consegna almeno una volta) e senza versione: si applicano
  assert.equal(leggiRegistro(h).chat.get("a")!.obiettivo!.stato, "bloccato");
});

test("passi: creati, modificati, completati, tolti; i passi di un sottoagente e le liste vuote", () => {
  const h = casa();
  const p = (passi: object[], agente = "") => ev("a", "passi", { passi, agente });
  const passo = (testo: string, stato: string, tolto = false) => ({ testo, stato, prova: "", tolto });
  scrivi(h, p([passo("Leggere il registro", "in_progress"), passo("Scrivere il test", "pending"), passo("Verificare tutto", "pending")]));
  assert.deepEqual(leggiRegistro(h).chat.get("a")!.passi.map((x) => x.stato), ["in_progress", "pending", "pending"]);
  scrivi(h, p([passo("Leggere il registro", "completed"), passo("Scrivere i test", "in_progress"), passo("Verificare tutto", "pending", true)]));
  scrivi(h, p([passo("Passo del figlio", "in_progress")], "agente-1")); // non è il piano dell'agente principale
  assert.deepEqual(leggiRegistro(h).chat.get("a")!.passi, [{ testo: "Leggere il registro", stato: "completed" }, { testo: "Scrivere i test", stato: "in_progress" }]);
  scrivi(h, p([]));
  assert.deepEqual(leggiRegistro(h).chat.get("a")!.passi, []);
});

test("piano con un passo fallito e la ripresa: lo stato segue il motore, i passi restano", () => {
  const h = casa();
  const passi = (stato: string) => ev("a", "passi", { agente: "", passi: [{ testo: "Lanciare la suite", stato, prova: "", tolto: false }] });
  scrivi(h, passi("in_progress"), ev("a", "rifiuto", { regola: "passi: prova_mancante", testo: "Lanciare la suite", modo: "blocca" }),
    ev("a", "stato", { stato: "serve_madre", dettaglio: "passi rifiutati 2 volte" }));
  let c = leggiRegistro(h).chat.get("a")!;
  assert.deepEqual([c.stato, c.passi[0].stato, c.rifiuto], ["serve_madre", "in_progress", "Lanciare la suite"]);
  scrivi(h, ev("a", "interrotta", { da: "roberto" }), ev("a", "battito", { stato: "lavora" }), passi("completed"), ev("a", "stato", { stato: "finito" }));
  c = leggiRegistro(h).chat.get("a")!;
  assert.deepEqual([c.stato, c.interrotta, c.passi[0].stato], ["finito", null, "completed"]);
});

test("dopo il cambio di chat (handoff) gli eventi in ritardo restano alla chat giusta", () => {
  const h = casa();
  scrivi(h, ev("a", "obiettivo", { stato: "aperto", testo: "Vecchio", versione: 1 }), ev("a", "fine", { motivo: "handoff", chat_nuova: "b" }),
    ev("b", "inizio", { titolo: "Nuova", da_handoff: "a" }), ev("b", "obiettivo", { stato: "aperto", testo: "Nuovo", versione: 2 }),
    ev("a", "obiettivo", { stato: "passato", testo: "Vecchio", versione: 2 }), ev("a", "battito", { stato: "lavora" }),
    ev("a", "passi", { agente: "", passi: [{ testo: "Ultimo passo", stato: "completed", prova: "", tolto: false }] }));
  const r = leggiRegistro(h);
  const [a, b] = [r.chat.get("a")!, r.chat.get("b")!];
  assert.deepEqual([a.fine, a.chatNuova, a.obiettivo!.stato, a.passi.length], ["handoff", "b", "passato", 1]);
  assert.deepEqual([b.fine, b.daHandoff, b.obiettivo, b.passi], [null, "a", { stato: "aperto", testo: "Nuovo" }, []]);
});

test("limite d'uso con account o ripartenza illeggibili, motore spento e impostazioni", () => {
  const h = casa();
  scrivi(h, ev("a", "stato", { stato: "ferma_limite", account: 5, riparte_alle: "domani" }), ev("friday", "friday", { evento: "stop" }),
    ev("friday", "impostazioni", { attiva: false, account: "" }), ev("friday", "non_disturbare", { acceso: true, fino: "mai", tenuti: "x" }));
  const r = leggiRegistro(h);
  assert.deepEqual(r.chat.get("a")!.limite, { account: null, ripartenza: null });
  assert.deepEqual([r.friday?.evento, r.impostazioni?.attiva, r.nonDisturbare], ["stop", false, { fino: null, tenuti: 0 }]);
});

test("riavvio: una nuova lettura degli stessi file dà lo stesso stato, con l'annullata ancora annullata", () => {
  const h = casa();
  const id = decisione(h);
  annulla(h, id, "ok");
  scrivi(h, ev("a", "obiettivo", { stato: "aperto", testo: "T", versione: 1 }), ev("a", "stato", { stato: "lavora" }));
  const prima = JSON.stringify(piano(leggiRegistro(h)));
  const dopo = JSON.stringify(piano(leggiRegistro(h)));
  assert.equal(prima, dopo);
  const d = leggiRegistro(h).decisioni[0];
  assert.deepEqual([d.annullata, d.annullabile], [true, false]);
});

test("comando preso senza esito (riavvio a metà): il comando c'è, l'esito no", () => {
  const h = casa();
  const cid = annulla(h, decisione(h));
  const r = leggiRegistro(h);
  assert.deepEqual([r.comandi.map((c) => c.id), r.esiti.has(cid)], [[cid], false]);
});

test("annulla: proposta solo con inverso e ricevuta; ricevuta di un'altra decisione o assente = no", () => {
  const h = casa();
  const buona = decisione(h), senzaInverso = decisione(h, { inverso: null, non_annullabile: "una merge" }), senzaRicevuta = decisione(h, {}, false);
  const altra = decisione(h, { cosa: "Altra" }, false);
  const d = path.join(h, ".claude", "friday", "eventi-locali", "decisione");
  fs.copyFileSync(path.join(d, buona), path.join(d, altra)); // la ricevuta di un'altra decisione
  const r = leggiRegistro(h);
  assert.deepEqual(r.decisioni.map((x) => [x.id, x.annullabile]), [[buona, true], [senzaInverso, false], [senzaRicevuta, false], [altra, false]]);
});

test("annulla: un comando scaduto o fallito si può ritentare, una decisione già annullata o interrotta no", () => {
  const h = casa();
  const [scaduta, fallita, perCli, giaAnnullata, interrotta] = [0, 1, 2, 3, 4].map(() => decisione(h));
  annulla(h, scaduta, "rifiutato", "Comando scaduto: era di più di un'ora fa.");
  annulla(h, fallita, "errore", "inverso fallito (1): boom");
  annulla(h, giaAnnullata, "rifiutato", `gia' annullata: ${giaAnnullata}`);
  annulla(h, interrotta, "rifiutato", `un'annulla di ${interrotta} si e' interrotta mentre girava: non la rifaccio, potrebbe essere gia' fatta. Controlla a mano`);
  // annullata dal terminale: nessun comando dell'app, solo la decisione «annullata <id>» con la sua ricevuta
  decisione(h, { cosa: `annullata ${perCli}`, inverso: null, non_annullabile: "", effetto_annullo: "" });
  const per = new Map(leggiRegistro(h).decisioni.map((d) => [d.id, d.annullabile]));
  assert.deepEqual([scaduta, fallita, perCli, giaAnnullata, interrotta].map((i) => per.get(i)), [true, true, false, false, false]);
});

test("doppio invio e doppio clic: un solo comando nella casella, entrambi ricevono la stessa risposta", async (t) => {
  const h = casa();
  fridayFinta(t, h, () => ({ esito: "ok", testo: "fatto" }), 60);
  const args = { chat: "11111111-0000-4000-8000-000000000001", testo: "Vai avanti" };
  const [x, y] = await Promise.all([inviaComando(h, "manda", args, opz), inviaComando(h, "manda", { ...args }, opz)]);
  assert.deepEqual(x, y);
  assert.equal(x.esito, "ok");
  assert.equal(fs.readdirSync(path.join(casella(h), "presi")).length, 1);
  const di = await inviaComando(h, "manda", args, opz); // finita la prima, un nuovo invio è un nuovo comando
  assert.notEqual(di.id, x.id);
  const altro = await Promise.all([inviaComando(h, "manda", args, opz), inviaComando(h, "manda", { ...args, testo: "Altro" }, opz)]);
  assert.notEqual(altro[0].id, altro[1].id);
  assert.equal(fs.readdirSync(path.join(casella(h), "presi")).length, 4);
});

test("doppio invio con la casella non scrivibile: nessun comando, la stessa spiegazione", async () => {
  const h = casa();
  fs.mkdirSync(path.join(h, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(h, ".claude", "casella"), "file");
  const [x, y] = await Promise.all([inviaComando(h, "ferma_tutto", {}, opz), inviaComando(h, "ferma_tutto", {}, opz)]);
  assert.deepEqual([x.esito, y.esito, x.id, y.id], ["non_scritto", "non_scritto", null, null]);
});

test("risposte collegate al comando giusto anche se arrivano in ordine inverso e doppie", async (t) => {
  const h = casa();
  fridayFinta(t, h, (c) => ({ esito: c.args.chat === "A" ? "ok" : "rifiutato", testo: `per ${c.args.chat}` }), 0);
  fridayFinta(t, h, () => null); // un secondo lettore che non risponde mai non cambia nulla
  const [a, b] = await Promise.all([inviaComando(h, "interrompi", { chat: "A" }, opz), inviaComando(h, "interrompi", { chat: "B" }, opz)]);
  assert.deepEqual([a.esito, a.testo, b.esito, b.testo], ["ok", "per A", "rifiutato", "per B"]);
});

test("risposta dopo un cambio di chat o di mese: l'esito arriva al comando, i dati restano alla chat del comando", async (t) => {
  const h = casa();
  scrivi(h, ev("A", "stato", { stato: "lavora" }));
  fridayFinta(t, h, () => null);
  const p = inviaComando(h, "manda", { chat: "A", testo: "Ciao" }, opz);
  await new Promise((ok) => setTimeout(ok, 80));
  scrivi(h, ev("A", "fine", { motivo: "handoff", chat_nuova: "B" }), ev("B", "inizio", { titolo: "Nuova", da_handoff: "A" }));
  const cid = leggiRegistro(h).comandi[0].id;
  fs.mkdirSync(dirReg(h), { recursive: true });
  fs.appendFileSync(fileMese(h, "2026-11"), JSON.stringify(ev("friday", "comando_fatto", { comando: cid, esito: "ok", testo: "mese nuovo" })) + "\n");
  const e = await p;
  assert.deepEqual([e.esito, e.testo], ["ok", "mese nuovo"]);
  const r = leggiRegistro(h);
  assert.deepEqual([r.comandi[0].args.chat, r.chat.get("A")!.chatNuova, r.chat.get("B")!.daHandoff], ["A", "B", "A"]);
});

test("Friday spenta, scaduto dopo la scadenza e poi l'esito arriva: il riavvio lo trova", async () => {
  const h = casa();
  const e = await inviaComando(h, "ferma_chat", { chat: "A" }, { ogniMs: 10, scadenzaMs: 80 });
  assert.deepEqual([e.esito, (e as any).preso, fs.readdirSync(casella(h))], ["scaduto", false, []]);
  scrivi(h, ev("friday", "comando_fatto", { comando: e.id, esito: "rifiutato", testo: "Comando scaduto" }));
  assert.equal(leggiRegistro(h).esiti.get(e.id!)?.esito, "rifiutato");
});

test("casella senza permessi di scrittura: non_scritto, senza .tmp lasciati", async (t) => {
  if (process.getuid?.() === 0) return t.skip("root scrive ovunque");
  const h = casa();
  fs.mkdirSync(casella(h), { recursive: true });
  fs.chmodSync(casella(h), 0o500);
  t.after(() => fs.chmodSync(casella(h), 0o700));
  const e = await inviaComando(h, "ferma_tutto", {}, opz);
  assert.deepEqual([e.esito, e.id, fs.readdirSync(casella(h))], ["non_scritto", null, []]);
});

test("non risponde: soglia dell'app diversa da quella del motore (20 min)", { todo: "aperto-codex: src/ui/chat/friday.ts e NON_RISPONDE_MS usano 180 s, il contratto e friday_triage.FERMO_S 20 min" }, () => {});
