// figma: 101-20859 — dove sta un sovrapposto (base/Sovrapposto.tsx): conto puro, provato in test/posiziona.test.ts.
export interface Punto { x: number; y: number }
export type Lato = "sotto" | "sopra" | "destra";
type Rett = { left: number; top: number; right: number; bottom: number };

/** Dal lato chiesto, ribaltato se lì non c'è posto e dall'altra parte sì, poi spinto dentro la finestra W×H col margine m.
 *  `fine`: sotto e sopra allinea il bordo destro, a destra allinea il fondo. */
export function posiziona(a: Rett, w: number, h: number, lato: Lato, fine: boolean, scarto: number, m: number, W: number, H: number): Punto & { lato: Lato } {
  let l = lato, x: number, y: number;
  if (l === "destra") {
    x = a.right + scarto; y = fine ? a.bottom - h : a.top;
    if (x + w > W - m && a.left - scarto - w >= m) x = a.left - scarto - w;
  } else {
    if (l === "sotto" && a.bottom + scarto + h > H - m && a.top - scarto - h >= m) l = "sopra";
    else if (l === "sopra" && a.top - scarto - h < m && a.bottom + scarto + h <= H - m) l = "sotto";
    y = l === "sotto" ? a.bottom + scarto : a.top - scarto - h;
    x = fine ? a.right - w : a.left;
  }
  return { x: Math.round(Math.max(m, Math.min(x, W - m - w))), y: Math.round(Math.max(m, Math.min(y, H - m - h))), lato: l };
}
