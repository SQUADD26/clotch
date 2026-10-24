// figma: 101-20859 — dove sta un sovrapposto (base/Sovrapposto.tsx): conto puro, provato in test/posiziona.test.ts.
export interface Punto { x: number; y: number }
export type Lato = "sotto" | "sopra" | "destra";
export type Allinea = "inizio" | "fine" | "centro";
type Rett = { left: number; top: number; right: number; bottom: number };

/** Dal lato chiesto, ribaltato se lì non c'è posto e dall'altra parte sì, poi spinto dentro la finestra W×H col margine m.
 *  `allinea`: sotto e sopra = bordo sinistro, destro o centro; a destra = cima, fondo o centro. */
export function posiziona(a: Rett, w: number, h: number, lato: Lato, allinea: Allinea, scarto: number, m: number, W: number, H: number): Punto & { lato: Lato } {
  let l = lato, x: number, y: number;
  if (l === "destra") {
    x = a.right + scarto; y = allinea === "fine" ? a.bottom - h : allinea === "centro" ? (a.top + a.bottom - h) / 2 : a.top;
    if (x + w > W - m) {
      if (a.left - scarto - w >= m) x = a.left - scarto - w;
      // né a destra né a sinistra c'è posto: sotto o sopra l'ancora, mai sopra di lei (#1113)
      else return posiziona(a, w, h, "sotto", "inizio", scarto, m, W, H);
    }
  } else {
    if (l === "sotto" && a.bottom + scarto + h > H - m && a.top - scarto - h >= m) l = "sopra";
    else if (l === "sopra" && a.top - scarto - h < m && a.bottom + scarto + h <= H - m) l = "sotto";
    y = l === "sotto" ? a.bottom + scarto : a.top - scarto - h;
    x = allinea === "fine" ? a.right - w : allinea === "centro" ? (a.left + a.right - w) / 2 : a.left;
  }
  return { x: Math.round(Math.max(m, Math.min(x, W - m - w))), y: Math.round(Math.max(m, Math.min(y, H - m - h))), lato: l };
}
