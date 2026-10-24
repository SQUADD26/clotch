// Macchine SSH (#479): i comandi del contratto, l'esito con macchine/passi, gli eventi `macchina_passo` nel registro, le regole dei passi (nome, ripresa, comando, codice).
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { COMANDI, leggiRegistro } from "../src/clotch-ai";
import { inviaComando } from "../src/comandi";
import type { PassoMacchina } from "../src/macchine-tipi";
import { nomeValido, passiDi, passoFermo, righePassi, titoloECorpo } from "../src/ui/chat/macchine";

const casa = () => fs.mkdtempSync(path.join(os.tmpdir(), "macchine-"));
const casella = (h: string) => path.join(h, ".claude", "casella", "comandi");
const mese = (h: string) => path.join(h, ".claude", "registro", `${new Date().toISOString().slice(0, 7)}.jsonl`);
const riga = (tipo: string, dati: object, n = 1) => JSON.stringify({ v: 1, id: "r-000000000000", t: new Date().toISOString(), n, chat: "friday", macchina: "mac", hook_v: "x", tipo, dati }) + "\n";

/** Un motore finto: prende il primo comando dalla casella e scrive la risposta `dati` come comando_fatto. */
function motoreFinto(h: string, dati: object) {
  const t = setInterval(() => {
    let nomi: string[] = [];
    try { nomi = fs.readdirSync(casella(h)).filter((n) => n.endsWith(".json")); } catch {}
    if (!nomi.length) return;
    clearInterval(t);
    const c = JSON.parse(fs.readFileSync(path.join(casella(h), nomi[0]), "utf8"));
    fs.renameSync(path.join(casella(h), nomi[0]), path.join(casella(h), `${nomi[0]}.fatto`));
    fs.mkdirSync(path.dirname(mese(h)), { recursive: true });
    fs.appendFileSync(mese(h), riga("comando_fatto", { comando: c.id, ...dati }));
  }, 10);
}

test("macchine: i tre comandi del contratto sono comandi dell'app", () => {
  for (const c of ["macchine", "macchina_aggiungi", "macchina_togli"]) assert.ok((COMANDI as readonly string[]).includes(c), c);
});

test("macchine: l'esito di `macchine` porta elenco e proposte; quello di `macchina_aggiungi` la voce e i passi", async () => {
  const h = casa();
  const m = { nome: "rise", host: "rise", porta: 22, utente: "roberto", chiave: null, cartella: "/srv/x", stato: "pronta", fonte: "tabella", locale: false, passo: null, testo: null, comando: null };
  const p = { desktop_id: "d1", nome: "build-server", host: "10.0.4.21", porta: 22, utente: "deploy", chiave: "~/.ssh/id_ed25519" };
  motoreFinto(h, { esito: "ok", testo: "1 macchine pronte", macchine: [m], proposte: [p] });
  const e = await inviaComando(h, "macchine", {}, { ogniMs: 20, scadenzaMs: 3000 });
  assert.deepEqual(e, { id: e.id, esito: "ok", testo: "1 macchine pronte", macchine: [m], proposte: [p] });
  motoreFinto(h, { esito: "rifiutato", testo: "Claude non è installato.", macchina: { ...m, nome: "x", stato: "da_completare" }, passi: [{ passo: "claude", ok: false, testo: "Claude non è installato.", comando: null }] });
  const a = await inviaComando(h, "macchina_aggiungi", { nome: "x", cartella: "/srv/x", host: "x" }, { ogniMs: 20, scadenzaMs: 3000 });
  assert.equal(a.esito, "rifiutato");
  assert.equal("voce" in a && a.voce?.stato, "da_completare", "`macchina` oggetto = la voce, non il nome della macchina di nuova_sessione");
  assert.deepEqual(passiDi(a)?.map((x) => x.passo), ["claude"]);
});

test("macchine: gli eventi `macchina_passo` arrivano dal registro, senza il contenuto di una chiave", () => {
  const h = casa();
  fs.mkdirSync(path.dirname(mese(h)), { recursive: true });
  fs.writeFileSync(mese(h), riga("macchina_passo", { nome: "b", passo: "python" }, 1) + riga("macchina_passo", { nome: "b", passo: "python", ok: true, testo: "3.11.2", comando: null }, 2)
    + riga("macchina_passo", { nome: "b", passo: "github", url: "https://github.com/login/device", codice: "8F3A-21C7" }, 3) + riga("macchina_passo", { passo: "x" }, 4));
  const r = leggiRegistro(h);
  assert.deepEqual(r.passiMacchina?.map((x) => [x.nome, x.passo, x.ok, x.testo, x.url, x.codice]),
    [["b", "python", null, null, null, null], ["b", "python", true, "3.11.2", null, null], ["b", "github", null, null, "https://github.com/login/device", "8F3A-21C7"]]);
});

test("macchine: il nome è minuscole, numeri e trattini, da 1 a 32", () => {
  for (const ok of ["rise", "build-server", "a", "x1-2", "a".repeat(32)]) assert.ok(nomeValido(ok), ok);
  for (const no of ["", "Build Server", "build_server", "è", "a".repeat(33), "a b"]) assert.ok(!nomeValido(no), no);
});

const ev = (passo: string, ok: boolean | null, x: Partial<PassoMacchina> = {}): PassoMacchina => ({ nome: "b", passo, ok, testo: null, comando: null, url: null, codice: null, t: 10, ...x });
const base = { nome: "b", cartella: "/home/d/p", da: 5 };

test("passi: ogni evento cambia una riga, il resto resta in attesa", () => {
  const r = righePassi({ ...base, eventi: [ev("connessione", true), ev("python", true, { testo: "3.11.2" }), ev("cartella", null), ev("claude", true, { nome: "altra" }), ev("claude", true, { t: 1 })] });
  assert.deepEqual(r.map((x) => `${x.passo}:${x.stato}:${x.dettaglio}`), ["connessione:ok:Collegata", "python:ok:3.11.2", "cartella:corso:In corso", "claude:attesa:In attesa", "motore:attesa:In attesa", "login:attesa:In attesa", "github:attesa:In attesa"],
    "gli eventi di un'altra macchina o di prima della partenza non contano");
});

test("passi: un passo fallito mostra il testo del motore e si ripara con lo stesso comando; il comando di login è «da fare nel Terminale»", () => {
  const f = righePassi({ ...base, eventi: [ev("connessione", true), ev("claude", false, { testo: "Claude non è installato. Il comando claude non esiste su b. Installalo, poi riprova." })] });
  assert.equal(passoFermo(f)?.passo, "claude");
  assert.deepEqual(titoloECorpo(passoFermo(f)!.testo!), { titolo: "Claude non è installato", corpo: "Il comando claude non esiste su b. Installalo, poi riprova." });
  assert.equal(f.find((x) => x.passo === "claude")?.dettaglio, "Non riuscito");
  const l = righePassi({ ...base, eventi: [ev("login", false, { comando: "ssh -t d@h 'claude login'" })] });
  assert.equal(l.find((x) => x.passo === "login")?.dettaglio, "Da fare nel Terminale");
  assert.equal(passoFermo(l)?.comando, "ssh -t d@h 'claude login'");
});

test("passi: la ripresa riparte dal passo fallito («Ripreso da qui»), anche con l'evento fallito del giro prima", () => {
  const eventi = [ev("connessione", true), ev("claude", false, { t: 10, testo: "no" })];
  const r = righePassi({ ...base, eventi, ripreso: { passo: "claude", t: 20 } });
  assert.deepEqual(r.filter((x) => x.stato !== "attesa").map((x) => `${x.passo}:${x.stato}:${x.dettaglio}`), ["connessione:ok:Collegata", "claude:corso:Ripreso da qui"]);
  const dopo = righePassi({ ...base, eventi: [...eventi, ev("claude", true, { t: 30, testo: "2.1.4" })], ripreso: { passo: "claude", t: 20 } });
  assert.equal(dopo.find((x) => x.passo === "claude")?.dettaglio, "2.1.4");
});

test("passi: una macchina da completare riparte dal passo fermo; «pronta» chiude tutti i passi", () => {
  const f = righePassi({ ...base, da: Infinity, eventi: [], fermata: { passo: "claude", testo: "Claude non è installato.", comando: null } });
  assert.deepEqual(f.map((x) => x.stato), ["ok", "ok", "ok", "no", "attesa", "attesa", "attesa"]);
  assert.equal(righePassi({ ...base, eventi: [ev("python", true)], fatto: true }).every((x) => x.stato === "ok"), true);
});

test("passi: il codice di GitHub arriva con url e codice mentre il passo aspetta", () => {
  const g = righePassi({ ...base, eventi: [ev("github", null, { url: "https://github.com/login/device", codice: "8F3A-21C7" })] }).find((x) => x.passo === "github")!;
  assert.deepEqual([g.stato, g.dettaglio, g.url, g.codice], ["corso", "In attesa del codice", "https://github.com/login/device", "8F3A-21C7"]);
});
