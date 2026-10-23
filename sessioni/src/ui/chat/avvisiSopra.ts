// figma: 101-48368 — gli avvisi a comparsa stanno sopra la casella, a spazio/4 dal suo bordo alto (101-24007), qualunque altezza abbia.
import { useLayoutEffect, type RefObject } from "react";
import { numero } from "../base/token";

/** Mette `--avvisi-basso` sulla colonna (base/avvisi.css) finché la casella è montata e a ogni cambio della sua altezza. */
export function useAvvisiSopra(casella: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = casella.current, colonna = el?.closest<HTMLElement>(".colonna");
    if (!el || !colonna) return;
    const metti = () => colonna.style.setProperty("--avvisi-basso", `${colonna.getBoundingClientRect().bottom - el.getBoundingClientRect().top + numero("spazio-4")}px`);
    metti();
    const o = new ResizeObserver(metti);
    o.observe(el);
    return () => { o.disconnect(); colonna.style.removeProperty("--avvisi-basso"); };
  }, [casella]);
}
