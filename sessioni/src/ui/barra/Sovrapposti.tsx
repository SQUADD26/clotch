// figma: 101-30304 — guscio comune dei pannelli che galleggiano sopra la barra (menu filtro 101:16778, raggruppa 101:30304, scelta icona 101:12169).
// Posizione fissa nel punto dato; si chiude con Esc o con un clic fuori, come Menu della base.
import { usaDentro } from "../base/dentro";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** `sopra`: il menu sta sopra il punto (il suo bordo basso coincide con y), come il menu del profilo sopra il piede (101:21498). */
export interface Punto { x: number; y: number; sopra?: boolean }

export function Sovrapposto({ a, className, onChiudi, children }: { a: Punto; className: string; onChiudi(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  usaDentro(ref);
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    const fuori = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onChiudi(); };
    addEventListener("keydown", tasto);
    addEventListener("mousedown", fuori);
    return () => { removeEventListener("keydown", tasto); removeEventListener("mousedown", fuori); };
  }, [onChiudi]);
  const stile: CSSProperties = { position: "fixed", left: a.x, ...(a.sopra ? { bottom: innerHeight - a.y } : { top: a.y }) };
  return <div ref={ref} className={className} style={stile}>{children}</div>;
}

/** Punto accanto a un elemento: a destra della barra, alla sua altezza (101:16778, 101:30304). */
export function accanto(el: Element, scarto = 0): Punto {
  const r = el.getBoundingClientRect();
  const barra = el.closest(".barra-laterale")?.getBoundingClientRect() ?? r;
  return { x: barra.right + scarto, y: r.top };
}
