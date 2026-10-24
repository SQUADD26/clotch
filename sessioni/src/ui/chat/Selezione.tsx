// figma: 101-28471 — «Testo selezionato»: il testo scelto nel filo (fondo «attesa», in base/evidenza.css) e «menu selezione»
// 101:28634 al clic destro: Copia ⌘C, Seleziona tutto ⌘A, Chiedi a clotch AI. Senza testo scelto il menu ha solo «Seleziona tutto».
import { useEffect, useState, type RefObject } from "react";
import { avvisa } from "../base/Avvisi";
import { Menu } from "../base/Menu";
import { useNavigazione } from "../base/navigazione";
import { chiediA } from "./chiedi";

interface Aperto { x: number; y: number; testo: string; link: string }

const scelto = (filo: HTMLElement) => {
  const s = getSelection();
  return s && !s.isCollapsed && filo.contains(s.anchorNode) && filo.contains(s.focusNode) ? s.toString().trim() : "";
};

/** `prova`: «x,y» di una scena di prova: sceglie l'ultima risposta e apre il menu in quel punto, come dopo un clic destro. */
export function MenuSelezione({ filo, prova = null }: { filo: RefObject<HTMLElement | null>; prova?: string | null }) {
  const [aperto, setAperto] = useState<Aperto | null>(null);
  const n = useNavigazione();

  useEffect(() => {
    const f = filo.current;
    if (!f) return;
    const clic = (e: MouseEvent) => {
      e.preventDefault();
      const l = (e.target as Element).closest<HTMLElement>("a[href], [data-link]");
      setAperto({ x: e.clientX, y: e.clientY, testo: scelto(f), link: l?.getAttribute("href") ?? l?.dataset.link ?? "" });
    };
    f.addEventListener("contextmenu", clic);
    return () => f.removeEventListener("contextmenu", clic);
  }, [filo]);

  useEffect(() => {
    const f = filo.current, risposte = f?.querySelectorAll(".testo-risposta");
    if (prova === null || !f || !risposte?.length) return;
    getSelection()?.selectAllChildren(risposte[risposte.length - 1]);
    const [x, y] = prova.split(",").map(Number);
    setAperto({ x, y, testo: scelto(f), link: "" });
  }, [prova, filo]);

  if (!aperto || !filo.current) return null;
  const f = filo.current, t = aperto.testo, l = aperto.link;
  const copiaTesto = (x: string) => navigator.clipboard.writeText(x).catch(() => avvisa({ tipo: "errore", messaggio: "Copia non riuscita" }));
  const copia = () => copiaTesto(t);
  return (
    <Menu ancora={{ x: aperto.x, y: aperto.y }} onChiudi={() => setAperto(null)} voci={[
      ...(l ? [
        ...(/^https?:\/\//i.test(l) ? [{ icona: "apri-fuori" as const, etichetta: "Apri il link", fai: () => { window.open(l, "_blank", "noopener"); } }] : []),
        { icona: "link" as const, etichetta: "Copia link", fai: () => copiaTesto(l) },
        "separatore" as const,
      ] : []),
      ...(t ? [{ icona: "copia" as const, etichetta: "Copia", scorciatoia: "⌘C", fai: copia }] : []),
      { etichetta: "Seleziona tutto", scorciatoia: "⌘A", fai: () => getSelection()?.selectAllChildren(f) },
      ...(t ? ["separatore" as const, { icona: "scintille" as const, etichetta: "Chiedi a clotch AI", fai: () => { chiediA(`«${t}»\n`); n.apri("clotch-ai"); } }] : []),
    ]} />
  );
}
