// figma: 101-28232 — «Visore immagine»: velo sulla finestra, nome e «1 di 2», «Copia», «Salva con nome…», chiudi, frecce tra le immagini del filo.
import { useEffect, useRef, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Velo } from "../base/Sovrapposto";
import { casella, type VoceGalleria } from "./percorsi";
import { useImmagine } from "./Allegati";
import "./visore.css";

export function Visore({ galleria, indice, onIndice, onChiudi }: { galleria: VoceGalleria[]; indice: number; onIndice(i: number): void; onChiudi(): void }) {
  const v = galleria[indice];
  const [giro, setGiro] = useState(0);
  const url = useImmagine(v?.da ?? null, giro);
  const n = galleria.length;
  const [rotta, setRotta] = useState(false);
  // zoom: 1 = adattata al riquadro; sopra 1 si trascina
  const [zoom, setZoom] = useState(1);
  const [sposta, setSposta] = useState({ x: 0, y: 0 });
  const trascina = useRef<{ x: number; y: number } | null>(null);
  const imposta = (z: number) => { const m = Math.min(5, Math.max(1, z)); setZoom(m); if (m === 1) setSposta({ x: 0, y: 0 }); };
  useEffect(() => { setRotta(false); imposta(1); }, [indice]);
  const riprova = () => { setRotta(false); setGiro((g) => g + 1); };
  const vai = (d: number) => onIndice((indice + d + n) % n);
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && n > 1) vai(-1);
      else if (e.key === "ArrowRight" && n > 1) vai(1);
      else if (e.key === "+" || e.key === "=") imposta(zoom * 1.5);
      else if (e.key === "-") imposta(zoom / 1.5);
      else if (e.key === "0") imposta(1);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", tasto);
    return () => removeEventListener("keydown", tasto);
  });
  if (!v) return null;
  const copia = async () => avvisa(await casella().copiaImmagine(v.da).catch(() => false) ? { tipo: "successo", messaggio: "Immagine copiata" } : { tipo: "errore", messaggio: "Immagine non copiata" });
  const salva = async () => { if (await casella().salvaImmagine(v.da, v.nome).catch(() => false)) avvisa({ tipo: "successo", messaggio: "Immagine salvata" }); };
  // il velo comune (base/Sovrapposto) sta in fondo al body: il filo ha `content-visibility`, che lo chiuderebbe dentro la colonna; Esc e fuoco che torna sono suoi
  return (
    <Velo className="visore-velo" onChiudi={onChiudi}>
      {n > 1 && <button type="button" className="freccia" onClick={() => vai(-1)} aria-label="Immagine precedente"><Icona nome="indietro" colore="primaria" /></button>}
      <div className="visore" role="dialog" aria-modal="true" aria-label={v.nome}>
        <div className="barra-visore">
          <span className="nome t-sm">{v.nome} · {indice + 1} di {n}</span>
          <Bottone tipo="secondario" onClick={copia}>Copia</Bottone>
          <Bottone tipo="secondario" onClick={salva}>Salva con nome…</Bottone>
          <button type="button" className="chiudi" autoFocus onClick={onChiudi} aria-label="Chiudi"><Icona nome="chiudi" colore="primaria" /></button>
        </div>
        <div className={`immagine-visore${url === undefined ? " carico" : ""}`} data-zoom={zoom > 1 ? "su" : "giu"}
          onWheel={(e) => { if (e.ctrlKey) imposta(zoom * (e.deltaY < 0 ? 1.25 : 0.8)); }}
          onDoubleClick={() => imposta(zoom > 1 ? 1 : 2)}
          onPointerDown={(e) => { if (zoom > 1) { trascina.current = { x: e.clientX - sposta.x, y: e.clientY - sposta.y }; e.currentTarget.setPointerCapture(e.pointerId); } }}
          onPointerMove={(e) => { if (trascina.current) setSposta({ x: e.clientX - trascina.current.x, y: e.clientY - trascina.current.y }); }}
          onPointerUp={() => { trascina.current = null; }}>
          {url && !rotta ? <img src={url} alt={v.nome} draggable={false} style={{ transform: `translate(${sposta.x}px, ${sposta.y}px) scale(${zoom})` }} onError={() => setRotta(true)} />
            : url === null || rotta ? <div className="non-letta"><Icona nome="immagine" colore="terziaria" /><span className="t-sm secondario">Immagine non letta</span><Bottone tipo="secondario" onClick={riprova}>Riprova</Bottone></div> : null}
        </div>
      </div>
      {n > 1 && <button type="button" className="freccia" onClick={() => vai(1)} aria-label="Immagine successiva"><Icona nome="avanti" colore="primaria" /></button>}
    </Velo>
  );
}
