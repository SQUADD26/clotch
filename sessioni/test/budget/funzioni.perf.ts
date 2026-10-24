// Tetti di tempo e di memoria per le funzioni pesanti del processo principale (#486, contro il lag di #474).
// Dati finti grandi creati qui. Lanciare con `node --expose-gc` (npm run prestazioni:funzioni): senza, la memoria non si misura.
// Come sono scelti i tetti: ~4× la mediana misurata sul codice buono (Linux, 1 core libero), per assorbire un runner CI lento; il codice
// prima di #474 sta da 10× a 100× sopra, quindi il margine non nasconde il difetto.
// Le funzioni sono prese dal modulo come `any`: prima di #474 alcune API (lettoreRegistro, sporchi) non c'erano e la prova deve girare lo stesso.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as clot from "../../src/clotch-ai";
import { Cronologia } from "../../src/cronologia";
import { leggiElenco } from "../../src/elenco";
import { aggiornaVoce, Indice } from "../../src/indice";
import { Osservatore } from "../../src/osserva";
import { trovaRadici } from "../../src/radici";
import { usoAlGiorno } from "../../src/quote-uso";
import { casa, coppia, creaRegistro, creaSessioni, heapMB, mediana, rigaRegistro, tempo, tempoAsync, transcriptGrande, U } from "./dati-finti";

const T = { giroMs: 40, raffica200Ms: 500, elencoFermoMs: 30, voce50MbMs: 40, voceMB: 50, indiceScriviMs: 25, usoMs: 400, registroMs: 10, registroMB: 60,
  cronoPrimaMs: 800, cronoRaffica500Ms: 100, cronoMB: 150 };
const N = 6000; // sessioni del Mac di Roberto: migliaia, in 3 account che linkano la stessa cartella
const nuovo = (h: string) => fs.rmSync(h, { recursive: true, force: true });
const tocca = (f: string, n: number) => fs.appendFileSync(f, coppia(path.basename(f, ".jsonl"), 10_000 + n));

test(`giro dal vivo con ${N} sessioni e un file toccato: mediana sotto ${T.giroMs} ms`, (t) => {
  const h = casa("giro"); t.after(() => nuovo(h));
  const { file } = creaSessioni(h, N);
  const o = new Osservatore(h, () => {}, {}, 20);
  o.giro(); // il primo giro fa anche il controllo di tutti i file
  const giri: number[] = [];
  for (let i = 0; i < 9; i++) { tocca(file[0], i); o.tocca(file[0]); giri.push(tempo(() => o.giro())); }
  o.ferma();
  console.log(`giro: mediana ${mediana(giri).toFixed(1)} ms`);
  assert.ok(mediana(giri) < T.giroMs, `giro: mediana ${mediana(giri).toFixed(1)} ms, tetto ${T.giroMs}`);
});

test(`raffica: 200 trascrizioni crescono insieme, un giro sotto ${T.raffica200Ms} ms`, (t) => {
  const h = casa("raffica"); t.after(() => nuovo(h));
  const { file } = creaSessioni(h, N);
  const o = new Osservatore(h, () => {}, {}, 20);
  o.giro();
  file.slice(0, 200).forEach((f, i) => { tocca(f, i); o.tocca(f); });
  const ms = tempo(() => o.giro());
  o.ferma();
  console.log(`raffica 200 file: ${ms.toFixed(1)} ms`);
  assert.ok(ms < T.raffica200Ms, `raffica: ${ms.toFixed(1)} ms, tetto ${T.raffica200Ms}`);
});

test(`elenco con ${N} file invariati (cartella linkata da 3 account): rilettura sotto ${T.elencoFermoMs} ms`, (t) => {
  const h = casa("elenco"); t.after(() => nuovo(h));
  creaSessioni(h, N);
  const leggi = () => (leggiElenco as any)({ home: h, env: {}, sporchi: [] });
  assert.equal(leggi().sessioni.length, N);
  const ms = mediana([1, 2, 3].map(() => tempo(leggi)));
  console.log(`elenco fermo: mediana ${ms.toFixed(1)} ms`);
  assert.ok(ms < T.elencoFermoMs, `elenco fermo: ${ms.toFixed(1)} ms, tetto ${T.elencoFermoMs}`);
});

test(`indice: 20 righe nuove su un transcript da 50 MB, sotto ${T.voce50MbMs} ms e ${T.voceMB} MB`, (t) => {
  const h = casa("voce"); t.after(() => nuovo(h));
  const file = path.join(h, `${U(1)}.jsonl`), s = { id: U(1), file, sorgente: "claude-code" as const, titolo: "grande" };
  transcriptGrande(file, 50, U(1));
  const d = {}, memo = new Map();
  aggiornaVoce(d, s, memo); // lettura da capo, non misurata
  const prima = heapMB(), ms: number[] = [];
  for (let i = 0; i < 5; i++) { for (let k = 0; k < 10; k++) tocca(file, i * 10 + k); ms.push(tempo(() => aggiornaVoce(d, s, memo))); }
  const mb = heapMB() - prima;
  console.log(`voce 50 MB: mediana ${mediana(ms).toFixed(1)} ms, heap +${mb.toFixed(0)} MB`);
  assert.ok(mediana(ms) < T.voce50MbMs, `voce: ${mediana(ms).toFixed(1)} ms, tetto ${T.voce50MbMs}`);
  assert.ok(mb < T.voceMB, `voce: heap +${mb.toFixed(0)} MB, tetto ${T.voceMB}`);
});

test(`indice: una sessione cambiata tra 1500 grandi, scrittura su disco sotto ${T.indiceScriviMs} ms`, async (t) => {
  const h = casa("indice"); t.after(() => nuovo(h));
  const { file } = creaSessioni(h, 1500, { coppie: 80 });
  const sessioni = file.map((f, i) => ({ id: U(i), file: f, sorgente: "claude-code" as const, titolo: `s${i}` }));
  const idx = new Indice(path.join(h, "app"), 60_000);
  await idx.metti(sessioni, true);
  idx.scrivi(); // prima scrittura completa, non misurata
  tocca(file[7], 1);
  await idx.metti([sessioni[7]]);
  const ms = tempo(() => idx.scrivi());
  console.log(`indice scrivi: ${ms.toFixed(1)} ms`);
  assert.ok(ms < T.indiceScriviMs, `indice scrivi: ${ms.toFixed(1)} ms, tetto ${T.indiceScriviMs} (riscrivere tutto l'indice blocca il main)`);
});

test(`uso degli account: ${N} trascrizioni, 5 cresciute, riconteggio sotto ${T.usoMs} ms`, async (t) => {
  const h = casa("uso"); t.after(() => nuovo(h));
  const { file } = creaSessioni(h, N);
  const radici = trovaRadici(h);
  await usoAlGiorno(radici); // lettura da capo, non misurata
  file.slice(0, 5).forEach((f, i) => tocca(f, i));
  const ms = await tempoAsync(() => usoAlGiorno(radici));
  console.log(`uso: ${ms.toFixed(0)} ms`);
  assert.ok(ms < T.usoMs, `uso: ${ms.toFixed(0)} ms, tetto ${T.usoMs}`);
});

test(`registro di 12 mesi (24 MB), una riga nuova: lettura sotto ${T.registroMs} ms e ${T.registroMB} MB`, (t) => {
  const h = casa("registro"); t.after(() => nuovo(h));
  const { file, ultimo } = creaRegistro(h, 12, 2);
  const leggi: () => unknown = (clot as any).lettoreRegistro ? (clot as any).lettoreRegistro(h) : () => (clot as any).leggiRegistro(h); // prima di #474 solo la lettura intera
  leggi();
  const prima = heapMB(), ms: number[] = [];
  for (let i = 0; i < 9; i++) { fs.appendFileSync(file, rigaRegistro(ultimo + 1 + i)); ms.push(tempo(leggi)); }
  const mb = heapMB() - prima;
  console.log(`registro: mediana ${mediana(ms).toFixed(2)} ms, heap +${mb.toFixed(0)} MB`);
  assert.ok(mediana(ms) < T.registroMs, `registro: ${mediana(ms).toFixed(2)} ms, tetto ${T.registroMs}`);
  assert.ok(mb < T.registroMB, `registro: heap +${mb.toFixed(0)} MB, tetto ${T.registroMB}`);
});

test(`cronologia di un transcript da 50 MB: prima pagina sotto ${T.cronoPrimaMs} ms, raffica di 500 righe sotto ${T.cronoRaffica500Ms} ms, heap sotto ${T.cronoMB} MB`, (t) => {
  const h = casa("crono"); t.after(() => nuovo(h));
  const file = path.join(h, `${U(2)}.jsonl`), s = { id: U(2), file, sorgente: "claude-code" as const };
  transcriptGrande(file, 50, U(2));
  const prima = heapMB(), c = new Cronologia();
  const p0 = tempo(() => assert.ok(c.pagina(s, 0, { v: 1 }).messaggi.length > 0));
  for (let k = 0; k < 250; k++) tocca(file, k); // 250 coppie = 500 righe
  const p1 = tempo(() => c.aggiorna(s));
  const mb = heapMB() - prima;
  console.log(`cronologia 50 MB: prima pagina ${p0.toFixed(0)} ms, raffica ${p1.toFixed(0)} ms, heap +${mb.toFixed(0)} MB`);
  assert.ok(p0 < T.cronoPrimaMs, `prima pagina: ${p0.toFixed(0)} ms, tetto ${T.cronoPrimaMs}`);
  assert.ok(p1 < T.cronoRaffica500Ms, `raffica: ${p1.toFixed(0)} ms, tetto ${T.cronoRaffica500Ms}`);
  assert.ok(mb < T.cronoMB, `heap +${mb.toFixed(0)} MB, tetto ${T.cronoMB}`);
});
