// #1001: sessioni dell'app Claude su una macchina SSH. Il motore (finto) porta la trascrizione in ~/.claude/casella/trascrizioni/<host>/<cli>.jsonl;
// l'app la legge come una trascrizione normale. Contratto: `trascrizione_remota {sessione}`, risposta ok {percorso, byte, fonte} o rifiutato col testo.
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { COMANDI } from "../src/clotch-ai";
import { inviaComando } from "../src/comandi";
import { leggiElenco } from "../src/elenco";
import { leggiPagina } from "../src/messaggi";
import { svuotaCache } from "../src/quote-uso";

const HOST = "sandbox-app@51.83.1.9", NOME_SSH = "squaddv2", CLI = "cli-remota", APP = "local_remota-1";
const scrivi = (f: string, c: string) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); };
const riga = (testo: string) => JSON.stringify({ type: "user", cwd: "/work/x", message: { role: "user", content: testo }, timestamp: "2026-10-24T10:00:00Z" }) + "\n";
const mese = (h: string) => path.join(h, ".claude", "registro", `${new Date().toISOString().slice(0, 7)}.jsonl`);
const comandi = (h: string) => path.join(h, ".claude", "casella", "comandi");
// il motore vero scrive sotto il suo nome SSH («squaddv2»), non sotto l'indirizzo dell'app
const copia = (h: string, host = NOME_SSH) => path.join(h, ".claude", "casella", "trascrizioni", host, `${CLI}.jsonl`);

function casa(extra: object = {}) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "clotch-1001-"));
  scrivi(path.join(h, "Library", "Application Support", "Claude", "claude-code-sessions", "u1", "org", `${APP}.json`),
    JSON.stringify({ sessionId: APP, cliSessionId: CLI, title: "remota", cwd: "/work/x", lastActivityAt: 1, sshConfig: { sshHost: HOST }, ...extra }));
  fs.mkdirSync(path.join(h, ".claude", "projects"), { recursive: true });
  return h;
}

/** Motore finto: a ogni `trascrizione_remota` porta la coda nuova di `remoto` nella copia e risponde; `rifiuto` = risponde rifiutato. Conta le chiamate. */
function motore(h: string, remoto: { testo: string }, rifiuto?: string) {
  const chiamate: any[] = [];
  const t = setInterval(() => {
    let nomi: string[] = [];
    try { nomi = fs.readdirSync(comandi(h)).filter((n) => n.endsWith(".json")); } catch { return; }
    for (const n of nomi) {
      const c = JSON.parse(fs.readFileSync(path.join(comandi(h), n), "utf8"));
      fs.renameSync(path.join(comandi(h), n), path.join(comandi(h), `fatto-${n}.old`));
      chiamate.push(c);
      let dati: object;
      if (rifiuto) dati = { esito: "rifiutato", testo: rifiuto };
      else {
        const f = copia(h);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        const gia = fs.existsSync(f) ? fs.statSync(f).size : 0;
        fs.appendFileSync(f, remoto.testo.slice(gia)); // solo la coda nuova
        dati = { esito: "ok", testo: "", percorso: f, byte: fs.statSync(f).size, fonte: "ssh" };
      }
      fs.mkdirSync(path.dirname(mese(h)), { recursive: true });
      fs.appendFileSync(mese(h), JSON.stringify({ v: 1, id: "r-000000000000", t: new Date().toISOString(), n: 1, chat: "friday", macchina: "mac", hook_v: "x", tipo: "comando_fatto", dati: { comando: c.id, ...dati } }) + "\n");
    }
  }, 10);
  return { chiamate, ferma: () => clearInterval(t) };
}

const sessione = (h: string) => leggiElenco({ home: h, conProve: true }).sessioni.find((s) => s.id === CLI)!;
const manda = (h: string) => inviaComando(h, "trascrizione_remota", { sessione: APP }, { ogniMs: 20, scadenzaMs: 3000 });

test("#1001: ok -> l'elenco usa la copia del motore e la chat legge i messaggi; la coda nuova arriva alla chiamata dopo", async () => {
  const h = casa(), remoto = { testo: riga("uno") + riga("due") }, m = motore(h, remoto);
  try {
    assert.ok(COMANDI.includes("trascrizione_remota" as never));
    assert.equal(sessione(h).file.endsWith(".jsonl"), false, "prima: nessuna trascrizione sul Mac");
    assert.equal(leggiPagina(sessione(h), 0).errore, "trascrizione non trovata sul disco");

    const e = await manda(h);
    assert.equal(e.esito, "ok");
    assert.ok(e.esito === "ok" && e.percorso === copia(h) && e.fonte === "ssh" && e.byte === Buffer.byteLength(remoto.testo));
    assert.deepEqual(m.chiamate[0].args, { sessione: APP }, "l'app passa solo la sessione");
    assert.equal(sessione(h).file, copia(h));
    assert.deepEqual(leggiPagina(sessione(h), 0).messaggi.map((x: any) => x.testo), ["uno", "due"]);

    remoto.testo += riga("tre"); // la sessione ha lavorato ancora
    await manda(h);
    assert.deepEqual(leggiPagina(sessione(h), 0).messaggi.map((x: any) => x.testo), ["uno", "due", "tre"]);
  } finally { m.ferma(); svuotaCache(); fs.rmSync(h, { recursive: true, force: true }); }
});

test("#1001: rifiuto del motore -> il testo arriva intero all'app, nessuna copia", async () => {
  const h = casa(), m = motore(h, { testo: "" }, "macchina non raggiungibile: sandbox-app@51.83.1.9");
  try {
    const e = await manda(h);
    assert.deepEqual([e.esito, e.testo], ["rifiutato", "macchina non raggiungibile: sandbox-app@51.83.1.9"]);
    assert.equal(sessione(h).file.endsWith(".jsonl"), false);
  } finally { m.ferma(); svuotaCache(); fs.rmSync(h, { recursive: true, force: true }); }
});

test("#1001: copia già presente -> si legge subito, senza comandi; un nome macchina strano non esce dalla cartella", () => {
  const h = casa();
  try {
    scrivi(copia(h), riga("già qui"));
    const s = sessione(h);
    assert.equal(s.file, copia(h));
    assert.deepEqual(leggiPagina(s, 0).messaggi.map((x: any) => x.testo), ["già qui"]);
    assert.equal(fs.existsSync(comandi(h)), false, "nessun comando scritto");
  } finally { svuotaCache(); fs.rmSync(h, { recursive: true, force: true }); }
  const k = casa({ sshConfig: { sshHost: "../.." } });
  try {
    scrivi(path.join(k, ".claude", "casella", "trascrizioni", "..", "..", `${CLI}.jsonl`), riga("fuori"));
    assert.equal(sessione(k).file.endsWith(".jsonl"), false);
  } finally { svuotaCache(); fs.rmSync(k, { recursive: true, force: true }); }
});
