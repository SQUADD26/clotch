import { strict as assert } from "node:assert";
import { test } from "node:test";
import { daAvvisare, inSilenzio } from "../src/avvisi";
import type { Sessione, Stato } from "../src/tipi";
import type { Adesso, Segno } from "../src/situazione";

const GIORNO = new Date(2026, 9, 23, 15, 0);
const sess = (stato: Stato, adesso?: Adesso, segni: Segno[] = []): Sessione => ({
  id: "a", titolo: "Backend: auth e RLS", stato, situazione: adesso ? { adesso, strumento: null, inCoda: 0, segni } : null,
} as Sessione);
const tutti = { silenzio: "Mai" };

test("passaggi: attesa, finita, errore, limite, ognuno col suo testo disegnato e il titolo della sessione", () => {
  const lavora = sess("lavora", "lavora");
  assert.deepEqual(daAvvisare(lavora, sess("aspetta", "lavora"), tutti, GIORNO), { titolo: "Backend: auth e RLS", corpo: "Permesso richiesto", silenzioso: false, suono: "Glass" });
  assert.equal(daAvvisare(lavora, sess("aspetta", "domanda"), tutti, GIORNO)?.corpo, "Domanda per te");
  assert.equal(daAvvisare(lavora, sess("aspetta", "piano"), tutti, GIORNO)?.corpo, "Piano da approvare");
  assert.equal(daAvvisare(lavora, sess("finita", "turno_finito"), tutti, GIORNO)?.corpo, "Finita");
  assert.equal(daAvvisare(lavora, sess("lavora", "errore"), tutti, GIORNO)?.corpo, "Errore");
  assert.equal(daAvvisare(lavora, sess("lavora", "lavora", ["negata_da_regola"]), tutti, GIORNO)?.corpo, "Bloccato da una regola");
  assert.equal(daAvvisare(lavora, sess("lavora", "lavora", ["comando_fallito"]), tutti, GIORNO)?.corpo, "Comando non riuscito");
  assert.equal(daAvvisare(lavora, sess("lavora", "limite"), tutti, GIORNO)?.corpo, "Limite di uso raggiunto");
});

test("mai ripetuto per lo stesso stato; sessione mai vista e finita da ferma = niente", () => {
  assert.equal(daAvvisare(sess("aspetta"), sess("aspetta"), tutti, GIORNO), null);
  assert.equal(daAvvisare(sess("lavora", "limite"), sess("lavora", "limite"), tutti, GIORNO), null);
  assert.equal(daAvvisare(sess("lavora", "lavora", ["comando_fallito"]), sess("lavora", "lavora", ["comando_fallito"]), tutti, GIORNO), null);
  assert.equal(daAvvisare(undefined, sess("aspetta"), tutti, GIORNO), null);
  assert.equal(daAvvisare(sess("ferma"), sess("finita"), tutti, GIORNO), null);
  assert.equal(daAvvisare(sess("aspetta"), sess("lavora"), tutti, GIORNO), null);
});

test("interruttori spenti: nessun avviso per quel caso, gli altri restano", () => {
  const l = sess("lavora");
  assert.equal(daAvvisare(l, sess("aspetta"), { ...tutti, avvisoAttesa: false }, GIORNO), null);
  assert.equal(daAvvisare(l, sess("finita"), { ...tutti, avvisoFinita: false }, GIORNO), null);
  assert.equal(daAvvisare(l, sess("lavora", "errore"), { ...tutti, avvisoErrori: false }, GIORNO), null);
  assert.equal(daAvvisare(l, sess("lavora", "limite"), { ...tutti, avvisoLimite: false }, GIORNO), null);
  assert.equal(daAvvisare(l, sess("finita"), { ...tutti, avvisoAttesa: false, avvisoErrori: false, avvisoLimite: false }, GIORNO)?.corpo, "Finita");
});

test("silenzio: «Mai», intervallo normale e a cavallo di mezzanotte", () => {
  const a = (h: number, m = 0) => new Date(2026, 9, 23, h, m);
  assert.equal(inSilenzio("Mai", a(3)), false);
  assert.equal(inSilenzio("22:00–8:00", a(23)), true);
  assert.equal(inSilenzio("22:00–8:00", a(0, 30)), true);
  assert.equal(inSilenzio("22:00–8:00", a(7, 59)), true);
  assert.equal(inSilenzio("22:00–8:00", a(8)), false);
  assert.equal(inSilenzio("22:00–8:00", a(21, 59)), false);
  assert.equal(inSilenzio("23:00–7:00", a(22, 30)), false);
  assert.equal(inSilenzio("23:00–7:00", a(6)), true);
  assert.equal(inSilenzio("9:00–17:00", a(12)), true);
  assert.equal(inSilenzio("9:00–17:00", a(18)), false);
  assert.equal(daAvvisare(sess("lavora"), sess("aspetta"), { silenzio: "22:00–8:00" }, a(23)), null);
  assert.ok(daAvvisare(sess("lavora"), sess("aspetta"), { silenzio: "22:00–8:00" }, a(12)));
  assert.equal(daAvvisare(sess("lavora"), sess("aspetta"), {}, a(23)), null, "senza impostazioni vale la partenza 22:00–8:00");
});

test("suono: Vetro e Pop di sistema, Campanello quello predefinito, Nessun suono muto; solo per «in attesa»", () => {
  const a = (suono: string) => daAvvisare(sess("lavora"), sess("aspetta"), { ...tutti, suono }, GIORNO)!;
  assert.deepEqual([a("Vetro").suono, a("Vetro").silenzioso], ["Glass", false]);
  assert.deepEqual([a("Pop").suono, a("Pop").silenzioso], ["Pop", false]);
  assert.deepEqual([a("Campanello").suono, a("Campanello").silenzioso], [undefined, false]);
  assert.equal(a("Nessun suono").silenzioso, true);
  assert.equal(daAvvisare(sess("lavora"), sess("finita"), { ...tutti, suono: "Vetro" }, GIORNO)!.silenzioso, true);
});
