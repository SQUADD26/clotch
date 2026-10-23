import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { copiaHome } from "./aiuti";
import { Osservatore } from "../src/osserva";
import { Aggiornamento } from "../src/tipi";

test("aggiornamento dal vivo: arriva solo la coda nuova, con l'id della sessione", async () => {
  const home = copiaHome();
  const A = "aaaaaaaa-0000-4000-8000-000000000001";
  const file = path.join(home, ".claude", "projects", "-Users-x-app", `${A}.jsonl`);
  const arrivi: Aggiornamento[] = [];
  const o = new Osservatore(home, (a) => arrivi.push(a), {}, 20);
  o.avvia();
  try {
    // FSEvents parte qualche istante dopo fs.watch: si scrive finché l'osservatore risponde (prima risposta = sta guardando)
    const P = "aaaaaaaa-0000-4000-8000-0000000000ff", prova = path.join(path.dirname(file), `${P}.jsonl`);
    for (let i = 0; i < 100 && !arrivi.some((a) => a.sessioni.includes(P)); i++) {
      fs.appendFileSync(prova, JSON.stringify({ type: "user", sessionId: P, cwd: "/Users/x/app", message: { role: "user", content: `ping ${i}` } }) + "\n");
      await new Promise((r) => setTimeout(r, 50));
    }
    arrivi.length = 0;
    fs.appendFileSync(file, JSON.stringify({ type: "user", sessionId: A, cwd: "/Users/x/app", message: { role: "user", content: "e adesso?" } }) + "\n");
    fs.appendFileSync(file, '{"type":"assis'); // riga ancora a metà: aspetta il giro dopo
    for (let i = 0; i < 100 && !arrivi.some((a) => a.nuoviMessaggi.some((n) => n.id === A)); i++) await new Promise((r) => setTimeout(r, 50));
    const m = arrivi.flatMap((a) => a.nuoviMessaggi).filter((n) => n.id === A).flatMap((n) => n.messaggi);
    assert.deepEqual(m.map((x: any) => x.testo), ["e adesso?"]);
    fs.appendFileSync(file, 'tant","message":{"role":"assistant","content":[{"type":"text","text":"eccomi"}]}}\n');
    for (let i = 0; i < 100 && arrivi.flatMap((a) => a.nuoviMessaggi).filter((n) => n.id === A).flatMap((n) => n.messaggi).length < 2; i++) await new Promise((r) => setTimeout(r, 50));
    const tutti = arrivi.flatMap((a) => a.nuoviMessaggi).filter((n) => n.id === A).flatMap((n) => n.messaggi);
    assert.deepEqual(tutti.map((x: any) => x.testo), ["e adesso?", "eccomi"]);
  } finally {
    o.ferma();
  }
});

test("aggiornamento dal vivo: un evento perso non perde messaggi, il giro dopo raccoglie ogni file cresciuto", () => {
  const home = copiaHome();
  const A = "aaaaaaaa-0000-4000-8000-000000000001";
  const file = path.join(home, ".claude", "projects", "-Users-x-app", `${A}.jsonl`);
  const arrivi: Aggiornamento[] = [];
  const o = new Osservatore(home, (a) => arrivi.push(a), {}, 20);
  fs.appendFileSync(file, JSON.stringify({ type: "user", sessionId: A, cwd: "/Users/x/app", message: { role: "user", content: "senza evento" } }) + "\n");
  o.tocca(path.join(home, ".claude", "obiettivi", "altro.json")); // l'evento è di un altro file
  o.giro();
  o.ferma();
  const m = arrivi.flatMap((a) => a.nuoviMessaggi).filter((n) => n.id === A).flatMap((n) => n.messaggi);
  assert.deepEqual(m.map((x: any) => x.testo), ["senza evento"]);
});
