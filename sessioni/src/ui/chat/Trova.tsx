// figma: 101-23475 — «Trova nella sessione ⌘F»: «barra trova» 101:23594 in cima alla colonna (lente, testo cercato, «1 di 2», su, giù, chiudi).
// Cerca nel testo della colonna e del pannello (`.contenuto`). Le corrispondenze si colorano con le evidenziazioni del browser: il DOM non cambia.
import { useEffect, useRef, useState } from "react";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { registraAzione } from "../base/scorciatoie";
import "../base/evidenza.css";
import "./trova.css";
import { conTransizione } from "../base/movimento";

const RADICE = ".contenuto";

/** Un carattere come lo confronta chi cerca: senza accento, senza maiuscole, apostrofi e virgolette tipografici come i dritti. */
const norma = (c: string) => c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
const BLOCCO = "p,li,pre,div,h1,h2,h3,h4,h5,h6,td,th,blockquote,section,button";

/** Ogni punto del testo che contiene `testo`, anche attraverso grassetto e codice in linea (non fra due blocchi). La barra stessa non conta. */
function trovate(testo: string): Range[] {
  const radice = document.querySelector(RADICE);
  const q = [...testo].map(norma).join("");
  if (!radice || !q) return [];
  let pieno = "", blocco: Element | null = null;
  const pos: [Node, number][] = [];
  const giro = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
  for (let n = giro.nextNode(); n; n = giro.nextNode()) {
    if (n.parentElement?.closest(".trova")) continue;
    const b = n.parentElement?.closest(BLOCCO) ?? null;
    if (b !== blocco) { pieno += "\n"; pos.push([n, 0]); blocco = b; }
    [...(n.nodeValue ?? "")].forEach((c, i) => { const m = norma(c); pieno += m; for (let k = 0; k < m.length; k++) pos.push([n, i]); });
  }
  const out: Range[] = [];
  for (let i = pieno.indexOf(q); i >= 0; i = pieno.indexOf(q, i + q.length)) {
    const r = new Range();
    r.setStart(...pos[i]); r.setEnd(pos[i + q.length - 1][0], pos[i + q.length - 1][1] + 1);
    out.push(r);
  }
  return out;
}

/** Cambia quando il testo della colonna cambia (messaggi nuovi, blocchi aperti): le corrispondenze si rifanno. */
function useVersione(attiva: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const radice = document.querySelector(RADICE);
    if (!attiva || !radice) return;
    let quadro = 0;
    const o = new MutationObserver((m) => {
      if (m.every((x) => (x.target.parentElement ?? (x.target as Element)).closest?.(".trova"))) return;
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => setV((x) => x + 1));
    });
    o.observe(radice, { childList: true, subtree: true, characterData: true });
    return () => { o.disconnect(); cancelAnimationFrame(quadro); };
  }, [attiva]);
  return v;
}

/** `iniziale`: testo già cercato di una scena di prova (barra aperta); null = chiusa. */
export function Trova({ iniziale = null }: { iniziale?: string | null }) {
  const [aperta, setAperta] = useState(iniziale !== null);
  const [testo, setTesto] = useState(iniziale ?? "");
  const [k, setK] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const versione = useVersione(aperta);
  const [r, setR] = useState<Range[]>([]);
  const scorrere = useRef(false); // un cambio di scelta o di testo porta alla corrente; l'arrivo di messaggi no
  const i = r.length ? Math.min(k, r.length - 1) : 0;
  // dopo il disegno, quando il DOM ha già il testo nuovo
  useEffect(() => { setR(aperta ? trovate(testo) : []); }, [aperta, testo, versione]);

  // il tasto lo sceglie l'utente (Impostazioni · Scorciatoie, azione «trova»); lo ascolta il gestore dei tasti dell'app
  useEffect(() => registraAzione("trova", () => {
    void conTransizione(() => setAperta(true)).then(() => { campo.current?.focus(); campo.current?.select(); });
  }), []);

  useEffect(() => {
    if (!r.length) return;
    CSS.highlights.set("trova", new Highlight(...r));
    CSS.highlights.set("trova-corrente", new Highlight(r[i]));
    return () => { CSS.highlights.delete("trova"); CSS.highlights.delete("trova-corrente"); };
  }, [r, i]);

  useEffect(() => {
    if (scorrere.current) r[i]?.startContainer.parentElement?.scrollIntoView({ block: "center" });
    scorrere.current = false;
  }, [r, i]);

  if (!aperta) return null;
  const chiudi = () => void conTransizione(() => setAperta(false)).then(() => document.querySelector<HTMLTextAreaElement>(".area-casella textarea")?.focus()); // il fuoco torna alla casella, non cade sulla pagina
  const vai = (passo: number) => { if (r.length) { scorrere.current = true; setK((i + passo + r.length) % r.length); } };
  return (
    <div className="trova" role="search" onKeyDown={(e) => { if (e.key === "Escape") chiudi(); }}>
      <Icona nome="cerca" />
      <input ref={campo} autoFocus={iniziale === null} value={testo} placeholder="Cerca nella sessione" aria-label="Cerca nella sessione"
        onChange={(e) => { scorrere.current = true; setTesto(e.target.value); setK(0); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); vai(e.shiftKey ? -1 : 1); } }} />
      {testo && <span className="contatore" aria-live="polite">{r.length ? `${i + 1} di ${r.length}` : "Nessun risultato"}</span>}
      <BottoneIcona className="su" icona="giu" etichetta="Risultato precedente" disabled={!r.length} onClick={() => vai(-1)} />
      <BottoneIcona icona="giu" etichetta="Risultato successivo" disabled={!r.length} onClick={() => vai(1)} />
      <BottoneIcona icona="chiudi" etichetta="Chiudi" onClick={chiudi} />
    </div>
  );
}
