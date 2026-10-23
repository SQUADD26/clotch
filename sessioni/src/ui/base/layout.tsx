// figma: 101-29552 — finestre strette: sotto questa misura la barra laterale sta sopra la colonna, con il velo (768, 600, 480);
// 101-29399: la maniglia che ridimensiona la barra («Trascina per allargare. Doppio clic: 266 px»).
import { useEffect, useLayoutEffect, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { imposta, useImpostazioni } from "../impostazioni/stato";
import { useNavigazione } from "./navigazione";
import { numero } from "./token";
import "./layout.css";

/** La barra resta accanto alla colonna solo se questa tiene la bolla intera (1024 sì, 768 no, come nei frame). */
export const LARGHEZZA_BARRA_FISSA = numero("misura-barra-laterale") + numero("misura-bolla-max") + 2 * numero("spazio-4") + numero("spazio-2");
const BARRA_MIN = numero("misura-barra-laterale");
const BARRA_MAX = BARRA_MIN + numero("misura-pannello") / 2;

/** Larghezza (bordi compresi) di un elemento, misurata prima del primo disegno e poi a ogni cambio (0 finché non c'è). */
export function useLarghezza(ref: RefObject<HTMLElement | null>, attivo = true): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!attivo || !el) return;
    setW(el.getBoundingClientRect().width);
    const o = new ResizeObserver(([e]) => setW(e.borderBoxSize[0].inlineSize));
    o.observe(el);
    return () => o.disconnect();
  }, [ref, attivo]);
  return w;
}

/** Esc chiude la barra o il pannello che stanno sopra la colonna. */
export function useEscChiude(aperto: boolean, chiudi: () => void) {
  useEffect(() => {
    if (!aperto) return;
    const premi = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) chiudi(); };
    addEventListener("keydown", premi);
    return () => removeEventListener("keydown", premi);
  }, [aperto, chiudi]);
}

const dentro = (w: number) => Math.round(Math.min(BARRA_MAX, Math.max(BARRA_MIN, w)));

/** Larghezza della barra: quella salvata (se è un numero) o quella del disegno; `trascina` la cambia senza salvare, `fine` la salva. */
export function useLarghezzaBarra() {
  const salvata = useImpostazioni().barraLarghezza;
  const [provvisoria, setProvvisoria] = useState<number | null>(null);
  const w = provvisoria ?? (typeof salvata === "number" && Number.isFinite(salvata) ? dentro(salvata) : BARRA_MIN);
  return { w, trascina: (x: number) => setProvvisoria(dentro(x)), fine: (x: number) => { setProvvisoria(null); imposta("barraLarghezza", dentro(x)); } };
}

/** Maniglia sul bordo destro della barra: trascinare cambia la larghezza, doppio clic la riporta a quella del disegno. */
export function ManigliaBarra({ corpo, w, trascina, fine }: { corpo: RefObject<HTMLElement | null>; w: number } & Pick<ReturnType<typeof useLarghezzaBarra>, "trascina" | "fine">) {
  const [attiva, setAttiva] = useState(false);
  const prova = useNavigazione().sezione?.split("|").includes("maniglia"); // scena 101:29399: il passaggio del mouse, fermo
  const da = (e: PointerEvent) => (corpo.current ? e.clientX - corpo.current.getBoundingClientRect().left : w);
  const tasto = (e: KeyboardEvent) => {
    const passo = numero("spazio-4");
    if (e.key === "ArrowLeft") fine(w - passo); else if (e.key === "ArrowRight") fine(w + passo); else return;
    e.preventDefault();
  };
  return (
    <div className={`maniglia-barra${attiva ? " attiva" : ""}${prova ? " prova" : ""}`} style={{ left: w - numero("misura-trascina") / 2 }} role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label="Larghezza della barra laterale" aria-valuemin={BARRA_MIN} aria-valuemax={BARRA_MAX} aria-valuenow={w}
      onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntatore già finito: il trascinamento parte lo stesso */ } setAttiva(true); }}
      onPointerMove={(e) => { if (attiva) trascina(da(e)); }}
      onPointerUp={(e) => { setAttiva(false); fine(da(e)); }}
      onPointerCancel={() => { setAttiva(false); fine(w); }}
      onDoubleClick={() => fine(BARRA_MIN)} onKeyDown={tasto}>
      <span className="linea" />
      <span className="suggerimento-maniglia">Trascina per allargare. Doppio clic: {BARRA_MIN} px</span>
    </div>
  );
}
