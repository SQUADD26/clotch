import { useLayoutEffect, type RefObject } from "react";
import { numero } from "./token";

/** Tiene un popup dentro la finestra: dopo il montaggio e a ogni cambio di misura lo sposta (`translate`) fino a lasciare il margine `spazio-2` dai bordi.
 *  Conta anche i figli assoluti (il pannello SSH accanto al menu ambiente). Vale per ogni menu, popover e ricerca che lo chiama. */
export function usaDentro(ref: RefObject<HTMLElement | null>, presente = true) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = numero("spazio-2");
    const metti = () => {
      el.style.translate = "";
      const r = [el, ...[...el.children].filter((c) => getComputedStyle(c).position === "absolute")].map((c) => c.getBoundingClientRect());
      const l = Math.min(...r.map((q) => q.left)), a = Math.min(...r.map((q) => q.top));
      const d = Math.max(...r.map((q) => q.right)), b = Math.max(...r.map((q) => q.bottom));
      let dx = d > innerWidth - m ? innerWidth - m - d : 0, dy = b > innerHeight - m ? innerHeight - m - b : 0;
      if (l + dx < m) dx = m - l;
      if (a + dy < m) dy = m - a;
      if (dx || dy) el.style.translate = `${dx}px ${dy}px`;
    };
    const o = new ResizeObserver(metti);
    o.observe(el);
    addEventListener("resize", metti);
    return () => { o.disconnect(); removeEventListener("resize", metti); };
  }, [ref, presente]);
}
