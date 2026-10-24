// figma: 101-28232 — «Visore immagine»: velo sulla finestra, nome e «1 di 2», «Copia», «Salva con nome…», chiudi, frecce tra le immagini del filo.
import { useEffect, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { Velo } from "../base/Sovrapposto";
import { casella, type VoceGalleria } from "./percorsi";
import { useImmagine } from "./Allegati";
import "./visore.css";

export function Visore({ galleria, indice, onIndice, onChiudi }: { galleria: VoceGalleria[]; indice: number; onIndice(i: number): void; onChiudi(): void }) {
  const v = galleria[indice];
  const url = useImmagine(v?.da ?? null);
  const n = galleria.length;
  const [rotta, setRotta] = useState(false);
  useEffect(() => setRotta(false), [indice]);
  const vai = (d: number) => onIndice((indice + d + n) % n);
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && n > 1) vai(-1);
      else if (e.key === "ArrowRight" && n > 1) vai(1);
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
          <button type="button" className="chiudi" onClick={onChiudi} aria-label="Chiudi"><Icona nome="chiudi" colore="primaria" /></button>
        </div>
        <div className="immagine-visore">{url && !rotta ? <img src={url} alt={v.nome} onError={() => setRotta(true)} /> : url === null || rotta ? <span className="t-sm secondario">Immagine non letta</span> : null}</div>
      </div>
      {n > 1 && <button type="button" className="freccia" onClick={() => vai(1)} aria-label="Immagine successiva"><Icona nome="avanti" colore="primaria" /></button>}
    </Velo>
  );
}
