// figma: 101-20859 — la tastiera di ogni menu (#960): il fuoco entra sulla voce scelta o sulla prima, frecce, Home e Fine, scrivere salta alla voce, Tab chiude.
import { useEffect } from "react";

/** `el`: il contenitore delle voci (bottoni). `inizio`: voce col fuoco all'apertura se nessuna è «scelta». */
export function useTastiMenu(el: HTMLElement | null, onChiudi: () => void, inizio = 0) {
  useEffect(() => {
    if (!el) return;
    (el.querySelector<HTMLButtonElement>("button.scelta") ?? el.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")[inizio])?.focus();
    let cerca = "", quando = 0;
    const tasto = (e: KeyboardEvent) => {
      const b = [...el.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      // Tab chiude il menu (come un menu di sistema); il fuoco torna a chi lo ha aperto
      if (e.key === "Tab") { e.preventDefault(); onChiudi(); return; }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== " ") {
        // scrivere salta alla voce che comincia così; la stessa lettera ripetuta passa alla successiva
        cerca = Date.now() - quando > 700 ? e.key.toLowerCase() : cerca + e.key.toLowerCase();
        quando = Date.now();
        const dopo = [...b.slice(b.indexOf(document.activeElement as HTMLButtonElement) + 1), ...b];
        const ripetuta = [...cerca].every((c) => c === cerca[0]);
        (dopo.find((x) => x.textContent?.trim().toLowerCase().startsWith(ripetuta ? cerca[0] : cerca) ?? false))?.focus();
        e.preventDefault();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      const i = b.indexOf(document.activeElement as HTMLButtonElement);
      b[e.key === "Home" ? 0 : e.key === "End" ? b.length - 1 : (i + (e.key === "ArrowDown" ? 1 : b.length - 1)) % b.length]?.focus();
      e.preventDefault();
    };
    const scatola = el.parentElement ?? el; // anche i tasti mandati al menu intero
    scatola.addEventListener("keydown", tasto);
    return () => scatola.removeEventListener("keydown", tasto);
  }, [el]);
}
