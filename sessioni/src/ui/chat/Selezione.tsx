// figma: 101-28471 — «Testo selezionato»: il testo scelto nel filo (fondo «attesa», in base/evidenza.css) e «menu selezione»
// 101:28634 al clic destro: Copia ⌘C, Seleziona tutto ⌘A, Chiedi a clotch AI. Senza testo scelto il menu ha solo «Seleziona tutto».
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { avvisa } from "../base/Avvisi";
import { Menu } from "../base/Menu";
import { useNavigazione } from "../base/navigazione";
import { chiediA } from "./chiedi";

interface Aperto { x: number; y: number; testo: string }

const scelto = (filo: HTMLElement) => {
  const s = getSelection();
  return s && !s.isCollapsed && filo.contains(s.anchorNode) && filo.contains(s.focusNode) ? s.toString().trim() : "";
};

/** `prova`: «x,y» di una scena di prova: sceglie l'ultima risposta e apre il menu in quel punto, come dopo un clic destro. */
export function MenuSelezione({ filo, prova = null }: { filo: RefObject<HTMLElement | null>; prova?: string | null }) {
  const [aperto, setAperto] = useState<Aperto | null>(null);
  const rif = useRef<HTMLDivElement>(null);
  const n = useNavigazione();

  useEffect(() => {
    const f = filo.current;
    if (!f) return;
    const clic = (e: MouseEvent) => { e.preventDefault(); setAperto({ x: e.clientX, y: e.clientY, testo: scelto(f) }); };
    f.addEventListener("contextmenu", clic);
    return () => f.removeEventListener("contextmenu", clic);
  }, [filo]);

  useEffect(() => {
    const f = filo.current, risposte = f?.querySelectorAll(".testo-risposta");
    if (prova === null || !f || !risposte?.length) return;
    getSelection()?.selectAllChildren(risposte[risposte.length - 1]);
    const [x, y] = prova.split(",").map(Number);
    setAperto({ x, y, testo: scelto(f) });
  }, [prova, filo]);

  // il menu non esce dalla finestra
  useLayoutEffect(() => {
    const m = rif.current?.firstElementChild;
    if (!aperto || !m) return;
    const r = m.getBoundingClientRect();
    const x = Math.max(0, Math.min(aperto.x, innerWidth - r.width)), y = Math.max(0, Math.min(aperto.y, innerHeight - r.height));
    if (x !== aperto.x || y !== aperto.y) setAperto({ ...aperto, x, y });
  }, [aperto]);

  if (!aperto || !filo.current) return null;
  const f = filo.current, t = aperto.testo;
  const copia = () => navigator.clipboard.writeText(t).catch(() => avvisa({ tipo: "errore", messaggio: "Copia non riuscita" }));
  return createPortal(
    <div ref={rif} style={{ position: "fixed", left: aperto.x, top: aperto.y, zIndex: 10 }}>
      <Menu onChiudi={() => setAperto(null)} style={{ position: "static" }} voci={[
        ...(t ? [{ icona: "copia" as const, etichetta: "Copia", scorciatoia: "⌘C", fai: copia }] : []),
        { etichetta: "Seleziona tutto", scorciatoia: "⌘A", fai: () => getSelection()?.selectAllChildren(f) },
        ...(t ? ["separatore" as const, { icona: "scintille" as const, etichetta: "Chiedi a clotch AI", fai: () => { chiediA(`«${t}»\n`); n.apri("friday"); } }] : []),
      ]} />
    </div>,
    document.body,
  );
}
