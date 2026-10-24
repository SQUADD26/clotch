// figma: 101-23475 — «Trova nella sessione ⌘F»: «barra trova» 101:23594 in cima alla colonna (lente, testo cercato, «1 di 2», su, giù, chiudi).
// Cerca nel testo della colonna e del pannello (`.contenuto`). Le corrispondenze si colorano con le evidenziazioni del browser: il DOM non cambia.
import { useEffect, useRef, useState } from "react";
import { Icona } from "../base/Icona";
import { registraAzione } from "../base/scorciatoie";
import "../base/evidenza.css";
import "./trova.css";
import { conTransizione } from "../base/movimento";

const RADICE = ".contenuto";

/** Ogni punto del testo che contiene `testo` (senza badare alle maiuscole). La barra stessa non conta. */
function trovate(testo: string): Range[] {
  const radice = document.querySelector(RADICE);
  if (!radice || !testo) return [];
  const q = testo.toLowerCase(), out: Range[] = [];
  const giro = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
  for (let n = giro.nextNode(); n; n = giro.nextNode()) {
    if (n.parentElement?.closest(".trova")) continue;
    const t = (n.nodeValue ?? "").toLowerCase();
    for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + q.length)) {
      const r = new Range();
      r.setStart(n, i); r.setEnd(n, i + q.length);
      out.push(r);
    }
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
  const vai = (passo: number) => { if (r.length) { scorrere.current = true; setK((i + passo + r.length) % r.length); } };
  return (
    <div className="trova" role="search">
      <Icona nome="cerca" />
      <input ref={campo} autoFocus={iniziale === null} value={testo} placeholder="Cerca nella sessione" aria-label="Cerca nella sessione"
        onChange={(e) => { scorrere.current = true; setTesto(e.target.value); setK(0); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") conTransizione(() => setAperta(false));
          else if (e.key === "Enter") { e.preventDefault(); vai(e.shiftKey ? -1 : 1); }
        }} />
      {testo && <span className="contatore" aria-live="polite">{r.length ? `${i + 1} di ${r.length}` : "Nessun risultato"}</span>}
      <button type="button" className="icona-trova su" aria-label="Risultato precedente" disabled={!r.length} onClick={() => vai(-1)}><Icona nome="giu" /></button>
      <button type="button" className="icona-trova" aria-label="Risultato successivo" disabled={!r.length} onClick={() => vai(1)}><Icona nome="giu" /></button>
      <button type="button" className="icona-trova" aria-label="Chiudi" onClick={() => conTransizione(() => setAperta(false))}><Icona nome="chiudi" /></button>
    </div>
  );
}
