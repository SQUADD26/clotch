// figma: 101-20859 — un solo modo per tutto ciò che galleggia (menu, popover, tooltip, dialoghi, ricerca, #519): reso in fondo al body (mai tagliato
// da un contenitore), posto accanto a chi lo apre e tenuto dentro la finestra con margine `misura-margine-finestra`, livello da `--livello-*`.
// Esc e clic fuori chiudono solo quello in cima; alla chiusura il fuoco torna a chi lo aveva; i dialoghi tengono il Tab dentro.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { posiziona, type Allinea, type Lato, type Punto } from "./posiziona";
import { numero } from "./token";
import "./sovrapposto.css";

export type { Allinea, Lato, Punto };
/** Dove si appoggia: un elemento (il bottone che lo apre) o un punto (il clic destro). */
export type Ancora = Element | Punto;

const pila: object[] = [];
const FOCALIZZABILI = "button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select, [tabindex]:not([tabindex='-1'])";

/** Comportamento comune: Esc, clic fuori (non su `ancora`, che apre e chiude da sé), fuoco che torna, Tab dentro se `trappola`. */
export function useStrato(ref: RefObject<HTMLElement | null>, onChiudi: () => void, { ancora, trappola = false }: { ancora?: Ancora | null; trappola?: boolean } = {}) {
  const chiudi = useRef(onChiudi);
  chiudi.current = onChiudi;
  // chi aveva il fuoco, letto al primo disegno: prima che un campo con autoFocus dentro lo prenda (Cerca sessioni)
  const [prima] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    const io = {};
    pila.push(io);
    const cima = () => pila[pila.length - 1] === io;
    const tasto = (e: KeyboardEvent) => {
      if (!cima()) return;
      // il fuoco torna prima di chiudere: il bottone può sparire quando il sovrapposto non c'è più (azioni al passaggio)
      if (e.key === "Escape") { e.stopPropagation(); if (prima?.isConnected) prima.focus(); chiudi.current(); return; }
      if (e.key !== "Tab" || !trappola || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>(FOCALIZZABILI)];
      if (!f.length) return;
      const [primo, ultimo] = [f[0], f[f.length - 1]];
      const fuoriDa = !ref.current.contains(document.activeElement);
      if (fuoriDa || document.activeElement === (e.shiftKey ? primo : ultimo)) {
        (e.shiftKey ? ultimo : primo).focus();
        e.preventDefault();
      }
    };
    const fuori = (e: MouseEvent) => {
      const t = e.target as Node;
      // il bottone che apre e chiude (ancora, o quello col fuoco che dice di aprire qualcosa) fa da sé col suo clic
      const bottone = prima?.matches("[aria-expanded], [aria-haspopup]") ? prima : null;
      if (!cima() || ref.current?.contains(t) || (ancora instanceof Element && ancora.contains(t)) || bottone?.contains(t)) return;
      chiudi.current();
    };
    addEventListener("keydown", tasto, true);
    addEventListener("mousedown", fuori, true);
    return () => {
      pila.splice(pila.indexOf(io), 1);
      removeEventListener("keydown", tasto, true);
      removeEventListener("mousedown", fuori, true);
      // il fuoco torna a chi lo aveva solo se è rimasto dentro (una scelta che apre altro lo sposta già)
      if (prima?.isConnected && (!document.activeElement || document.activeElement === document.body || ref.current?.contains(document.activeElement))) prima.focus();
    };
  }, []);
}

const rett = (a: Ancora) => (a instanceof Element ? a.getBoundingClientRect() : new DOMRect(a.x, a.y, 0, 0));

interface Props {
  /** Assente: si appoggia al genitore del punto in cui è scritto (il contenitore del bottone). */
  ancora?: Ancora | null;
  lato?: Lato;
  /** Allineato al bordo finale dell'ancora: il destro sotto e sopra, quello in basso a destra. */
  fine?: boolean;
  /** Centrato sull'ancora (tooltip della chat). */
  centro?: boolean;
  /** Distanza dall'ancora; di serie `spazio-1-5` da un elemento, 0 da un punto. */
  scarto?: number;
  /** Tooltip: niente tastiera né clic fuori, non prende il fuoco. */
  passivo?: boolean;
  className: string;
  role?: string;
  label?: string;
  style?: CSSProperties;
  onChiudi?(): void;
  /** L'elemento che galleggia, per chi ci appoggia un altro sovrapposto (sottomenu). */
  rif?(el: HTMLDivElement | null): void;
  children: ReactNode;
}

/** Dove sta chi lo scrive: l'elemento genitore e la classe del suo pezzo (il CSS dei pezzi sta sotto `.pezzo-<nome>`). */
function useLuogo() {
  const segno = useRef<HTMLSpanElement>(null);
  const [luogo, setLuogo] = useState<{ genitore: Element; pezzo: string; centrato: boolean } | null>(null);
  useLayoutEffect(() => {
    const g = segno.current?.parentElement;
    if (g) setLuogo({ genitore: g, pezzo: g.closest(".pezzo")?.className ?? "", centrato: !!g.closest(".centrato") });
  }, []);
  return { segno: <span ref={segno} hidden />, luogo };
}

/** Fogli di stile della pagina, una volta, per la copia che esce (vive in un'ombra, fuori dalle ricerche nel documento). */
let stili: CSSStyleSheet | null = null;
const foglio = () => {
  if (!stili) {
    stili = new CSSStyleSheet();
    stili.replaceSync([...document.styleSheets].flatMap((f) => { try { return [...f.cssRules].map((r) => r.cssText); } catch { return []; } }).join("\n"));
  }
  return stili;
};

/** Alla chiusura una copia muta esce con l'animazione d'uscita, qualunque sia la via (Esc, clic, stato del chiamante).
 *  Sta in un'ombra: `querySelector` e il testo della pagina non la vedono, così chi riapre trova solo il nuovo. */
function useUscita(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current, pezzo = el?.parentElement?.className ?? "";
    return () => {
      if (!el || document.documentElement.classList.contains("parita")) return;
      const ospite = document.createElement("div"), ombra = ospite.attachShadow({ mode: "open" }), w = document.createElement("div");
      ombra.adoptedStyleSheets = [foglio()];
      const c = el.cloneNode(true) as HTMLElement;
      c.classList.add("esce");
      c.inert = true;
      w.className = pezzo;
      w.appendChild(c);
      ombra.appendChild(w);
      ospite.setAttribute("aria-hidden", "true");
      document.body.appendChild(ospite);
      const via = () => ospite.remove();
      c.addEventListener("animationend", via);
      setTimeout(via, numero("tempo-uscita")); // senza animazione (riduci movimento) non arriva animationend
    };
  }, []);
}

export function Sovrapposto(p: Props) {
  const { segno, luogo } = useLuogo();
  return <>{segno}{luogo && <Galleggia {...p} ancora={p.ancora ?? luogo.genitore} pezzo={luogo.pezzo} />}</>;
}

function Galleggia({ ancora, pezzo, lato = "sotto", fine = false, centro = false, scarto, passivo, className, role, label, style, onChiudi, rif, children }: Props & { ancora: Ancora; pezzo: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<(Punto & { lato: Lato }) | null>(null);
  const metti = () => {
    const el = ref.current;
    if (!el) return;
    const n = posiziona(rett(ancora), el.offsetWidth, el.offsetHeight, lato, centro ? "centro" : fine ? "fine" : "inizio", scarto ?? (ancora instanceof Element ? numero("spazio-1-5") : 0), numero("misura-margine-finestra"), innerWidth, innerHeight);
    setPos((v) => (v && v.x === n.x && v.y === n.y && v.lato === n.lato ? v : n));
  };
  // un punto arriva nuovo a ogni render: conta dove sta, non l'oggetto
  const dove = ancora instanceof Element ? ancora : `${ancora.x},${ancora.y}`;
  useLayoutEffect(metti, [dove, lato, fine, centro, scarto]);
  useEffect(() => {
    const o = new ResizeObserver(metti);
    if (ref.current) o.observe(ref.current);
    addEventListener("resize", metti);
    return () => { o.disconnect(); removeEventListener("resize", metti); };
  }, [dove, lato, fine, centro, scarto]);
  if (!passivo) useStrato(ref, () => onChiudi?.(), { ancora }); // passivo non cambia nella vita del componente
  useUscita(ref);
  useLayoutEffect(() => { rif?.(ref.current); return () => rif?.(null); }, []);
  return createPortal(
    <div className={pezzo}>
      <div ref={ref} className={`sovrapposto ${className}`} role={role} aria-label={label} data-lato={pos?.lato ?? lato} data-fine={fine || undefined}
        style={{ ...style, left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? undefined : "hidden" }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Velo a tutta finestra con il suo contenuto (dialoghi, ricerca): in fondo al body, Tab dentro, fuoco che torna.
 *  `centrato`: al centro esatto; vale anche se chi lo scrive sta in un contenitore `.centrato` (dialoghi nelle impostazioni). */
export function Velo({ className = "", centrato = false, onChiudi, children }: { className?: string; centrato?: boolean; onChiudi(): void; children: ReactNode }) {
  const { segno, luogo } = useLuogo();
  return <>{segno}{luogo && <VeloAperto className={`${className}${centrato || luogo.centrato ? " centrato" : ""}`} pezzo={luogo.pezzo} onChiudi={onChiudi}>{children}</VeloAperto>}</>;
}

function VeloAperto({ className, pezzo, onChiudi, children }: { className: string; pezzo: string; onChiudi(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useStrato(ref, onChiudi, { trappola: true });
  useUscita(ref);
  return createPortal(
    <div className={pezzo}>
      <div ref={ref} className={`velo ${className}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>{children}</div>
    </div>,
    document.body,
  );
}
