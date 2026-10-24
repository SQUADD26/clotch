import test from "node:test";
import assert from "node:assert/strict";

const CMD = "c-1";
const piano = { esiti: { [CMD]: { esito: "errore", testo: "modello letto x, chiesto y" } } };
(globalThis as any).window = { clotchAi: { registro: async () => piano, onRegistro: () => () => {} } };

// il registro è già in memoria: `cb` può arrivare dentro l'iscrizione, prima che `off` esista (#474)
test("seguiRegistro: errore già nel registro, il callback che usa off() non lancia e avvisa una volta", async () => {
  const { seguiRegistro } = await import("../src/ui/clotch-ai/dati");
  const primo = seguiRegistro(() => {});
  await new Promise((r) => setTimeout(r, 10)); // il registro è arrivato
  primo();
  let avvisi = 0;
  const lanci: unknown[] = [];
  process.on("uncaughtException", (e) => lanci.push(e));
  const guarda = () => { // la forma di guardaErrore in NuovaSessione.tsx
    const off = seguiRegistro((r) => {
      if (r.esiti.get(CMD)?.esito !== "errore") return;
      off(); avvisi++;
    });
  };
  assert.doesNotThrow(guarda);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(lanci, []);
  assert.equal(avvisi, 1);
});
