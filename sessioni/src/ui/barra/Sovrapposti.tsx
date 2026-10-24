// figma: 101-30304 — punto dei pannelli che galleggiano accanto alla barra (menu filtro 101:16778, raggruppa 101:30304, scelta icona 101:12169);
// il pannello stesso è base/Sovrapposto.
import type { Punto } from "../base/Sovrapposto";

/** Punto accanto a un elemento: a destra della barra, alla sua altezza (101:16778, 101:30304). */
export function accanto(el: Element, scarto = 0): Punto {
  const r = el.getBoundingClientRect();
  const barra = el.closest(".barra-laterale")?.getBoundingClientRect() ?? r;
  return { x: barra.right + scarto, y: r.top };
}
