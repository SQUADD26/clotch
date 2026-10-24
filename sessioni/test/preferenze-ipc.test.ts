// Handler reale compilato, Electron/clipboard/processi sempre sostituiti: nessuna GUI o copia sul Mac.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { runInNewContext } from "node:vm";

function azione(scrivi: (testo: string) => Promise<void>, idApp: string | null = "local_fixture", mostra: (p: string) => void = () => { throw new Error("Effetto del Mac vietato durante la prova"); }, file = "") {
  type Handler = (_e: unknown, id: string, azione: string) => unknown;
  const handlers = new Map<string, Handler>();
  const exports: { collegaPreferenze?: (...args: unknown[]) => void } = {};
  const vietato = () => { throw new Error("Effetto del Mac vietato durante la prova"); };
  const moduli: Record<string, unknown> = {
    "node:path": path,
    "node:fs": fs,
    "node:child_process": { execFile: vietato },
    electron: { app: { getPath: () => "/fixture-no-write" }, clipboard: { writeText: scrivi }, shell: { showItemInFolder: mostra } },
    "./finestra": { apriFinestra: vietato },
    "./preferenze": { leggiImpostazioni: () => ({}), leggiPreferenze: vietato, impostaImpostazioni: vietato, impostaPreferenze: vietato },
  };
  runInNewContext(fs.readFileSync(path.join(__dirname, "../src/preferenze-ipc.js"), "utf8"), {
    exports,
    require: (id: string) => {
      if (!(id in moduli)) throw new Error(`Import non previsto nella prova: ${id}`);
      return moduli[id];
    },
  }, { filename: "preferenze-ipc.js" });
  assert.ok(exports.collegaPreferenze);
  exports.collegaPreferenze({ handle: (nome: string, fn: Handler) => handlers.set(nome, fn) }, vietato, {
    impostazioni: () => {}, elencoSessioni: () => ({ sessioni: [{ id: "chat-fixture", cartella: "/fixture/progetto", idApp, file }] }),
  });
  return handlers.get("sessioni:azione")!;
}

test("clipboard asincrona: IPC attende la copia nei tre comandi", async () => {
  for (const [cmd, testo] of [["copia-id", "chat-fixture"], ["copia-cartella", "/fixture/progetto"], ["copia-link", "claude://code/continue?session=local_fixture"]]) {
    let termina!: () => void;
    const scritte: string[] = [];
    const handler = azione((t) => { scritte.push(t); return new Promise<void>((resolve) => { termina = resolve; }); });
    const risultato = handler(null, "chat-fixture", cmd);
    assert.ok(risultato instanceof Promise, `${cmd}: promessa inoltrata all'IPC`);
    let finita = false;
    const attesa = (risultato as Promise<void>).then(() => { finita = true; });
    await Promise.resolve();
    assert.equal(finita, false, `${cmd}: nessun successo prematuro`);
    assert.deepEqual(scritte, [testo]);
    termina(); await attesa;
    assert.equal(finita, true);
  }
  console.log("CLIPBOARD_IPC_AWAITS_ALL_COPIES_OK");
});

test("clipboard asincrona: rigetto di ogni copia torna al chiamante IPC", async () => {
  for (const cmd of ["copia-id", "copia-cartella", "copia-link"]) {
    const errore = new Error("CLIPBOARD_STUB_REJECTED");
    const handler = azione(() => Promise.reject(errore));
    await assert.rejects(Promise.resolve(handler(null, "chat-fixture", cmd)), (e: unknown) => e === errore);
  }
  console.log("CLIPBOARD_IPC_REJECTION_PROPAGATED_OK");
});

test("link non disponibile: errore prima della clipboard, chat estranea rifiutata", () => {
  let copie = 0;
  const handler = azione(async () => { copie++; }, null);
  assert.throws(() => handler(null, "chat-fixture", "copia-link"), /nessun link/);
  assert.throws(() => handler(null, "altra-chat", "copia-id"), /non trovata/);
  assert.equal(copie, 0);
});

test("mostra-nel-finder: evidenzia il file della sessione se c'è, altrimenti la cartella", () => {
  const aperti: string[] = [];
  azione(async () => {}, "local_fixture", (p) => aperti.push(p), __filename)(null, "chat-fixture", "mostra-nel-finder");
  azione(async () => {}, "local_fixture", (p) => aperti.push(p), "/fixture/non-esiste.jsonl")(null, "chat-fixture", "mostra-nel-finder");
  azione(async () => {}, "local_fixture", (p) => aperti.push(p))(null, "chat-fixture", "mostra-nel-finder");
  assert.deepEqual(aperti, [__filename, "/fixture/progetto", "/fixture/progetto"]);
});
