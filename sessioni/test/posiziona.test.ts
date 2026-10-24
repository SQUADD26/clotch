import test from "node:test";
import assert from "node:assert/strict";
import { posiziona } from "../src/ui/base/posiziona";

// #519: ogni sovrapposto sta dentro la finestra (margine 8) e si ribalta dal lato dove c'è posto.
const r = (left: number, top: number, w: number, h: number) => ({ left, top, right: left + w, bottom: top + h });

test("sotto il bottone, allineato a sinistra o a destra", () => {
  assert.deepEqual(posiziona(r(100, 50, 30, 30), 260, 300, "sotto", "inizio", 6, 8, 1440, 900), { x: 100, y: 86, lato: "sotto" });
  assert.deepEqual(posiziona(r(1300, 50, 30, 30), 260, 300, "sotto", "fine", 6, 8, 1440, 900), { x: 1070, y: 86, lato: "sotto" });
});

test("menu del profilo in fondo alla barra: sopra il piede; se non c'è posto sotto, si ribalta sopra", () => {
  assert.deepEqual(posiziona(r(8, 840, 250, 52), 260, 228, "sopra", "inizio", 4, 8, 1440, 900), { x: 8, y: 608, lato: "sopra" });
  assert.deepEqual(posiziona(r(8, 840, 250, 52), 260, 228, "sotto", "inizio", 4, 8, 1440, 900).lato, "sopra");
});

test("finestra stretta: mai fuori dal bordo destro né sinistro", () => {
  const p = posiziona(r(274, 108, 0, 0), 260, 106, "sotto", "inizio", 0, 8, 480, 768);
  assert.equal(p.x, 480 - 8 - 260);
  assert.equal(posiziona(r(-50, 108, 0, 0), 260, 106, "sotto", "inizio", 0, 8, 480, 768).x, 8);
});

test("a destra di un menu (sottomenu): fondi allineati, a sinistra se a destra non c'è posto", () => {
  assert.deepEqual(posiziona(r(8, 500, 300, 200), 300, 260, "destra", "fine", 8, 8, 1440, 900), { x: 316, y: 440, lato: "destra" });
  assert.equal(posiziona(r(900, 100, 300, 200), 300, 260, "destra", "inizio", 8, 8, 1440, 900).x, 592);
});

test("più alto della finestra: resta attaccato al margine in alto", () => {
  assert.equal(posiziona(r(100, 400, 30, 30), 260, 2000, "sotto", "inizio", 6, 8, 1440, 900).y, 8);
});

test("tooltip centrato sul bottone", () => {
  assert.equal(posiziona(r(100, 400, 30, 30), 90, 24, "sopra", "centro", 4, 8, 1440, 900).x, 70);
});

test("a destra senza posto né a destra né a sinistra: sotto l'ancora, non sopra di lei (#1113)", () => {
  const a = r(200, 100, 260, 250), p = posiziona(a, 320, 258, "destra", "inizio", 4, 8, 768, 741);
  assert.equal(p.lato, "sotto");
  assert.ok(p.y >= a.bottom + 4 || p.y + 258 <= a.top - 4);
});
