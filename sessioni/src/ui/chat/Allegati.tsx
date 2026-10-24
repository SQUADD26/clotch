// figma: 148-46383 — «Allegato nella casella» 148:43692, «Rimuovi allegato» 148:43627, «Spazio per rilascio» 148:43696 (una immagine 148:46383, tanti 148:47483, troppo grande 148:49251, trascinamento 148:45727)
// figma: 101-28041 — «chip allegato», «allegati messaggio» e «miniatura» nel filo
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Pezzi } from "../base/Pezzi";
import type { DaImmagine, FileAllegato, RifImmagine } from "../../tipi";
import { Icona } from "../base/Icona";
import { casella, chiaveImmagine, eImmagine, nomeFile, peso, statoAllegato } from "./percorsi";
import "./allegati.css";

/** Il visore: `apri` mostra l'immagine nella galleria del filo. Fuori dal filo non fa niente. */
export const VisoreContesto = createContext<{ sessione: string; apri(da: DaImmagine): void }>({ sessione: "", apri() {} });

const MAX_CACHE = 24;
const cache = new Map<string, Promise<string | null>>();
const leggi = (da: DaImmagine) => casella().immagine(da).catch(() => null);
// un file del disco si rilegge a ogni apertura (può essere riscritto); una riga della trascrizione non cambia. Una lettura fallita non resta in cache.
const carica = (da: DaImmagine) => {
  if ("percorso" in da) return leggi(da);
  const k = chiaveImmagine(da);
  let p = cache.get(k);
  if (!p) {
    p = leggi(da).then((u) => { if (u === null) cache.delete(k); return u; });
    cache.set(k, p);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  }
  return p;
};

/** L'immagine come indirizzo `data:`; undefined mentre si legge, null se non si legge. `giro` sale a ogni «Riprova». */
export function useImmagine(da: DaImmagine | null, giro = 0) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const k = da && chiaveImmagine(da);
  useEffect(() => {
    setUrl(undefined);
    if (!da) return;
    let vivo = true;
    void carica(da).then((u) => vivo && setUrl(u));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, giro]);
  return url;
}

type Chip = Pick<FileAllegato, "nome" | "tipo" | "byte"> & { dettaglio?: string; mancante?: boolean };

/** Il chip di un allegato nel filo (101:28041); nella casella ci sono le miniature, `Allegato`. */
export function ChipAllegato({ a, onApri }: { a: Chip; onApri?(): void }) {
  const corpo = (
    <>
      <Icona nome={a.tipo === "cartella" ? "cartella" : a.tipo === "immagine" ? "immagine" : "file"} />
      <span className="testi"><span className="nome">{a.nome}</span>
        <span className="dettaglio">{a.dettaglio ?? (a.tipo === "cartella" ? "Cartella" : peso(a.byte))}</span></span>
    </>
  );
  return (
    <span className={`chip-allegato${a.mancante ? " mancante" : ""}`}>
      {onApri ? <button type="button" className="apri" onClick={onApri} aria-label={`Apri ${a.nome}`}>{corpo}</button> : <span className="apri">{corpo}</span>}
    </span>
  );
}

/** Un file della casella: `carico` finché non se ne conosce il peso. */
export type AllegatoCasella = FileAllegato & { carico?: boolean };

const sigla = (nome: string) => /\.([^.]+)$/.exec(nome)?.[1].toUpperCase();
const dettaglioFile = (a: AllegatoCasella) => (a.carico ? "Caricando…" : statoAllegato(a) === "grande" ? "Troppo grande"
  : a.tipo === "cartella" ? "Cartella" : <Pezzi parti={[sigla(a.nome), peso(a.byte)]} />);

/** La miniatura di un allegato, sopra il testo della casella (148:43692 «Allegato nella casella»): immagine quadrata o riquadro col nome. */
export function Allegato({ a, onRimuovi }: { a: AllegatoCasella; onRimuovi(): void }) {
  const grande = statoAllegato(a) === "grande";
  const foto = a.tipo === "immagine" && !grande;
  const url = useImmagine(foto && !a.carico ? { percorso: a.percorso } : null);
  const [rotta, setRotta] = useState(false); // i byte ci sono ma non sono un'immagine: il browser mostrerebbe il solo testo alternativo
  const stato = grande || (foto && (url === null || rotta)) ? "errore" : a.carico || (foto && url === undefined) ? "carico" : "";
  return (
    <div className={`allegato ${foto ? "immagine" : "file"} ${stato}`} title={a.nome}>
      {foto ? (stato === "errore"
        ? <><Icona nome="avviso" colore="errore" /><span className="dettaglio">Non letta</span></>
        : url ? <img src={url} alt={a.nome} onError={() => setRotta(true)} /> : null) : (
        <>
          <div className="testa-allegato">
            {stato === "carico" ? <span className="sagoma" /> : <Icona nome={grande ? "avviso" : a.tipo === "cartella" ? "cartella" : "file"} colore={grande ? "errore" : "secondaria"} />}
            <span className="nome">{a.nome}</span>
          </div>
          <span className="dettaglio">{dettaglioFile(a)}</span>
        </>
      )}
      <button type="button" className="rimuovi-allegato" onClick={onRimuovi} aria-label={`Rimuovi ${a.nome}`}><Icona nome="chiudi" /></button>
    </div>
  );
}

/** La riga unica sopra il testo: scorre di lato, la casella non cresce. `rilascio`: file trascinati sulla finestra (148:45727). */
export function AllegatiCasella({ allegati, rilascio, onRimuovi }: { allegati: AllegatoCasella[]; rilascio: boolean; onRimuovi(a: AllegatoCasella): void }) {
  const riga = useRef<HTMLDivElement>(null);
  const prima = useRef(allegati.length);
  const tolto = useRef<number | null>(null); // posto dell'allegato tolto: il fuoco passa al successivo (o al precedente)
  useEffect(() => { // l'ultimo arrivato si vede
    if (allegati.length > prima.current) riga.current?.scrollTo({ left: riga.current.scrollWidth });
    prima.current = allegati.length;
    if (tolto.current === null) return;
    const x = riga.current?.querySelectorAll<HTMLElement>(".rimuovi-allegato");
    x?.[Math.min(tolto.current, x.length - 1)]?.focus();
    tolto.current = null;
  }, [allegati.length]);
  return (
    <div className="allegati-casella" ref={riga}>
      {allegati.map((a) => <Allegato key={a.percorso} a={a} onRimuovi={() => { tolto.current = allegati.indexOf(a); onRimuovi(a); }} />)}
      {rilascio && <div className="zona-rilascio"><Icona nome="graffetta" colore="accento" /><span>Rilascia per allegare</span></div>}
    </div>
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
    return f ?? { percorso: p, nome: nomeFile(p), tipo: eImmagine(p) ? "immagine" : "file", byte: null, dettaglio: trovati ? "Non trovato" : "", mancante: !!trovati };
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
        return <ChipAllegato key={p} a={a} onApri={a.mancante ? undefined : a.tipo === "immagine" ? () => apri({ percorso: p }) : () => void casella().mostra(p)} />;
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
  const [giro, setGiro] = useState(0);
  const url = useImmagine(da, giro);
  const [rotta, setRotta] = useState(false);
  const riprova = () => { setRotta(false); setGiro((g) => g + 1); };
  const mancante = url === null || rotta;
  return (
    <button type="button" className={`miniatura${url === undefined ? " carico" : ""}`} onClick={mancante ? riprova : onApri} aria-label={mancante ? `Riprova a leggere ${nome}` : `Apri ${nome}`}>
      {url && !rotta ? <img src={url} alt={nome} onError={() => setRotta(true)} /> : mancante ? <span className="non-letta"><Icona nome="immagine" colore="terziaria" />Immagine non letta. Riprova</span> : null}
    </button>
  );
}

const D = "/Users/privato/Desktop";
const f = (nome: string, tipo: FileAllegato["tipo"], byte: number | null, carico?: boolean): AllegatoCasella => ({ percorso: `${D}/${nome}`, nome, tipo, byte, ...(carico ? { carico } : {}) });
const notch = f("schermata-notch.png", "immagine", 312_000), lettore = f("lettore.ts", "file", 4_000);
/** Stati delle scene di prova, per la chiave di `allegati:<chiave>`: una immagine 148:46383, tanti 148:47483, troppo grande 148:49251, trascinamento 148:45727;
 *  senza chiave: un file, un'immagine, uno che si sta leggendo e uno oltre il limite. */
export const ALLEGATI_PROVA: Record<string, AllegatoCasella[]> = {
  "": [lettore, notch, f("registro.log", "file", null, true), f("prova.mov", "file", 480_000_000)],
  "una-immagine": [notch],
  tanti: [notch, lettore, f("moduli.png", "immagine", 90_000), f("piano-lavori.pdf", "file", 2_400_000), f("clienti.csv", "file", 81_000),
    f("cantiere.png", "immagine", 150_000), f("registro.log", "file", 3_000)],
  "troppo-grande": [notch, lettore, f("prova.mov", "file", 480_000_000)],
  trascinamento: [notch, lettore],
};
