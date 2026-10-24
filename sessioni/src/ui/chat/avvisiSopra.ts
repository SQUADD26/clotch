// figma: 101-48368 — gli avvisi a comparsa stanno sopra la casella, a spazio/4 dal suo bordo alto (101-24007), qualunque altezza abbia.
import { useLayoutEffect, type RefObject } from "react";
import { numero } from "../base/token";

/** Mette `--avvisi-basso` sulla colonna (base/avvisi.css) finché la casella è montata e a ogni cambio della sua altezza. */
export function useAvvisiSopra(casella: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = casella.current, colonna = el?.closest<HTMLElement>(".colonna");
    if (!el || !colonna) return;
    // un menu aperto sopra la casella (Aggiungi, Permessi, Modello) sta nello stesso punto: la pila sale sopra di lui, così l'avviso e «Riprova» restano interi
    const alto = () => Math.min(el.getBoundingClientRect().top, ...[...document.querySelectorAll(".sovrapposto.menu-casella:not([style*=hidden]), .sovrapposto.menu-aggiungi:not([style*=hidden])")].map((m) => m.getBoundingClientRect().top - numero("spazio-2")));
    const metti = () => colonna.style.setProperty("--avvisi-basso", `${colonna.getBoundingClientRect().bottom - alto() + numero("spazio-4")}px`);
    metti();
    const o = new ResizeObserver(metti), m = new MutationObserver(metti), st = new MutationObserver((r) => { if (r.some((x) => (x.target as Element).classList.contains("sovrapposto"))) metti(); });
    o.observe(el);
    m.observe(document.body, { childList: true });
    st.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["style"] }); // il menu prende il suo posto dopo essere comparso
    return () => { o.disconnect(); m.disconnect(); st.disconnect(); colonna.style.removeProperty("--avvisi-basso"); };
  }, [casella]);
}
