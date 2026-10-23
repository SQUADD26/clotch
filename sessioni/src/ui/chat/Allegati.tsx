// figma: 101-28041 — «chip allegato», «allegati messaggio» e «miniatura» nel filo; 101-25542 i chip nella casella (con la X per toglierli)
import { createContext, useContext, useEffect, useState } from "react";
import type { DaImmagine, FileAllegato, RifImmagine } from "../../tipi";
import { Icona } from "../base/Icona";
import { casella, chiaveImmagine, eImmagine, nomeFile, peso, statoAllegato } from "./percorsi";
import "./allegati.css";

/** Il visore: `apri` mostra l'immagine nella galleria del filo. Fuori dal filo non fa niente. */
export const VisoreContesto = createContext<{ sessione: string; apri(da: DaImmagine): void }>({ sessione: "", apri() {} });

const MAX_CACHE = 24;
const cache = new Map<string, Promise<string | null>>();
const carica = (da: DaImmagine) => {
  const k = chiaveImmagine(da);
  let p = cache.get(k);
  if (!p) {
    p = casella().immagine(da).catch(() => null);
    cache.set(k, p);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  }
  return p;
};

/** L'immagine come indirizzo `data:`; undefined mentre si legge, null se non si legge. */
export function useImmagine(da: DaImmagine | null) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const k = da && chiaveImmagine(da);
  useEffect(() => {
    setUrl(undefined);
    if (!da) return;
    let vivo = true;
    void carica(da).then((u) => vivo && setUrl(u));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return url;
}

/** Un file della casella: `carico` finché non se ne conosce il peso (101:25542 «Carico…»). */
export type AllegatoCasella = FileAllegato & { carico?: boolean };
type Chip = Pick<FileAllegato, "nome" | "tipo" | "byte"> & { dettaglio?: string; carico?: boolean };

export function ChipAllegato({ a, onApri, onRimuovi }: { a: Chip; onApri?(): void; onRimuovi?(): void }) {
  const stato = statoAllegato(a);
  const corpo = (
    <>
      {stato === "carico" ? <Icona nome="spinner" gira /> : stato === "grande" ? <Icona nome="avviso" colore="errore" />
        : <Icona nome={a.tipo === "cartella" ? "cartella" : a.tipo === "immagine" ? "immagine" : "file"} />}
      <span className="testi"><span className="nome">{a.nome}</span>
        <span className="dettaglio">{stato === "carico" ? "Carico…" : stato === "grande" ? "Troppo grande" : a.dettaglio ?? (a.tipo === "cartella" ? "Cartella" : peso(a.byte))}</span></span>
    </>
  );
  return (
    <span className="chip-allegato">
      {onApri ? <button type="button" className="apri" onClick={onApri} aria-label={`Apri ${a.nome}`}>{corpo}</button> : <span className="apri">{corpo}</span>}
      {onRimuovi && <button type="button" className="rimuovi" onClick={onRimuovi} aria-label={`Rimuovi ${a.nome}`}><Icona nome="chiudi" colore="terziaria" /></button>}
    </span>
  );
}

/** Peso e tipo dei file scritti in un messaggio (`@percorso`); uno che non c'è più resta come «Non trovato». */
function useDescrizioni(percorsi: string[]) {
  const [trovati, setTrovati] = useState<FileAllegato[] | null>(null);
  const k = percorsi.join("\n");
  useEffect(() => {
    if (!percorsi.length) return;
    let vivo = true;
    casella().descrivi(percorsi).then((d) => vivo && setTrovati(d), () => vivo && setTrovati([]));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return (p: string): Chip & { percorso: string } => {
    const f = trovati?.find((x) => x.percorso === p);
    return f ?? { percorso: p, nome: nomeFile(p), tipo: eImmagine(p) ? "immagine" : "file", byte: null, dettaglio: trovati ? "Non trovato" : "" };
  };
}

/** Sopra il messaggio di Roberto: le immagini incollate e i file scritti in fondo al testo. */
export function AllegatiMessaggio({ immagini, percorsi }: { immagini: RifImmagine[]; percorsi: string[] }) {
  const { sessione, apri } = useContext(VisoreContesto);
  const descrivi = useDescrizioni(percorsi);
  return (
    <div className="allegati-messaggio">
      {immagini.map((r) => (
        <ChipAllegato key={`${r.riga}:${r.n}`} a={{ nome: r.nome ?? "Immagine", tipo: "immagine", byte: r.byte }} onApri={() => apri({ sessione, rif: r })} />
      ))}
      {percorsi.map((p) => {
        const a = descrivi(p);
        return <ChipAllegato key={p} a={a} onApri={a.tipo === "immagine" ? () => apri({ percorso: p }) : undefined} />;
      })}
    </div>
  );
}

/** Le immagini di un esito (es. «Schermata»): miniature che aprono il visore. */
export function Miniature({ immagini, nome }: { immagini: RifImmagine[]; nome: string }) {
  const { sessione, apri } = useContext(VisoreContesto);
  return (
    <div className="miniature">
      {immagini.map((rif) => <Miniatura key={`${rif.riga}:${rif.n}`} da={{ sessione, rif }} nome={nome} onApri={() => apri({ sessione, rif })} />)}
    </div>
  );
}

function Miniatura({ da, nome, onApri }: { da: DaImmagine; nome: string; onApri(): void }) {
  const url = useImmagine(da);
  return (
    <button type="button" className="miniatura" onClick={onApri} aria-label={`Apri ${nome}`}>
      {url ? <img src={url} alt={nome} /> : url === null ? <span className="non-letta"><Icona nome="immagine" colore="terziaria" />Immagine non letta</span> : null}
    </button>
  );
}

/** Stato di una scena di prova (101:25542): un file, un'immagine, uno che si sta leggendo e uno oltre il limite. */
export const ALLEGATI_PROVA: AllegatoCasella[] = [
  { percorso: "/Users/privato/Desktop/lettore.ts", nome: "lettore.ts", tipo: "file", byte: 4_000 },
  { percorso: "/Users/privato/Desktop/schermata-notch.png", nome: "schermata-notch.png", tipo: "immagine", byte: 312_000 },
  { percorso: "/Users/privato/Desktop/registro.log", nome: "registro.log", tipo: "file", byte: null, carico: true },
  { percorso: "/Users/privato/Desktop/prova.mov", nome: "prova.mov", tipo: "file", byte: 480_000_000 },
];
