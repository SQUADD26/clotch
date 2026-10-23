// L'unico modo per parlare col processo main: window.sessioni (preload.ts), avvolto in hook con stato carica/pronto/errore.
// Schema dal vault (Research/App/ChatGPT): rete-e-api.md § «Dal vivo»: il renderer non fa rete, chiede al main via IPC e
// riceve gli eventi; esperienza-uso.md § «Stati»: i nuovi tentativi stanno nel main, il renderer offre solo «Riprova».
// Un aggiornamento dal vivo ricarica in silenzio: i dati vecchi restano a schermo finché arrivano i nuovi.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Aggiornamento, Elenco, Messaggio, PreferenzeSessione, SessioniApi } from "../../tipi";

declare global {
  interface Window { sessioni: SessioniApi }
}
export const api = (): SessioniApi => window.sessioni;

export type Stato<T> =
  | { stato: "carica"; dati?: undefined; errore?: undefined }
  | { stato: "pronto"; dati: T; errore?: undefined }
  | { stato: "errore"; dati?: T; errore: string };

/** «Error invoking remote method 'x': Error: perché» -> «perché». */
export const messaggioErrore = (e: unknown) =>
  String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, "");

/** Una chiamata al main. `ricarica()` la rifà tenendo i dati a schermo; `riprova()` dopo un errore. */
export function useChiamata<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [s, setS] = useState<Stato<T>>({ stato: "carica" });
  const giro = useRef(0);
  const vai = useCallback((silenzioso: boolean) => {
    const mio = ++giro.current;
    if (!silenzioso) setS({ stato: "carica" });
    fn().then(
      (dati) => mio === giro.current && setS({ stato: "pronto", dati }),
      (e) => mio === giro.current && setS((p) => ({ stato: "errore", dati: p.dati, errore: messaggioErrore(e) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { vai(false); return () => { giro.current++; }; }, [vai]);
  return { ...s, ricarica: () => vai(true), riprova: () => vai(false) };
}

/** Ascolta gli aggiornamenti dal vivo del main (file delle sessioni cambiati). */
export function useAggiornamenti(cb: (a: Aggiornamento) => void) {
  const ultimo = useRef(cb);
  ultimo.current = cb;
  useEffect(() => api().onAggiornamento((a) => ultimo.current(a)), []);
}

/** Elenco delle sessioni, ricaricato in silenzio quando una cambia. `dati.errori` = cartelle non lette. */
export function useElenco() {
  const c = useChiamata<Elenco>(() => api().elencoSessioni(), []);
  useAggiornamenti((a) => { if (a.sessioni.length) c.ricarica(); });
  return c;
}

/** Messaggi di una sessione: pagina 0 (i più recenti), `altri()` per le pagine vecchie, i nuovi arrivano dal vivo. */
export function useMessaggi(id: string | null) {
  const [pagine, setPagine] = useState({ messaggi: [] as Messaggio[], pagina: 0, haAltre: false, totale: null as number | null });
  const c = useChiamata(async () => {
    if (!id) return null;
    const p = await api().messaggi(id, 0);
    if (p.errore) throw new Error(p.errore);
    setPagine({ messaggi: p.messaggi, pagina: 0, haAltre: p.haAltre, totale: p.totale });
    return p;
  }, [id]);
  const [altriCarica, setAltriCarica] = useState(false);
  useAggiornamenti((a) => {
    const nuovi = a.nuoviMessaggi.filter((n) => n.id === id).flatMap((n) => n.messaggi);
    if (nuovi.length) setPagine((p) => ({ ...p, messaggi: [...p.messaggi, ...nuovi], totale: p.totale === null ? null : p.totale + nuovi.length }));
  });
  const altri = async () => {
    if (!id || altriCarica || !pagine.haAltre) return;
    setAltriCarica(true);
    try {
      const p = await api().messaggi(id, pagine.pagina + 1);
      if (p.errore) throw new Error(p.errore);
      setPagine((x) => ({ messaggi: [...p.messaggi, ...x.messaggi], pagina: p.pagina, haAltre: p.haAltre, totale: p.totale ?? x.totale }));
    } finally { setAltriCarica(false); }
  };
  return { stato: c.stato, errore: c.errore, riprova: c.riprova, ...pagine, altri, altriCarica };
}

/** Preferenze dell'app per sessione (#360): `dati[id]`, `imposta(id, parte)`; si aggiornano da sole quando cambiano. */
export function usePreferenze() {
  const c = useChiamata(() => api().preferenze(), []);
  const [dal, setDal] = useState<Record<string, PreferenzeSessione> | null>(null);
  useEffect(() => api().onPreferenze(setDal), []);
  return { stato: c.stato, errore: c.errore, riprova: c.riprova, dati: dal ?? c.dati ?? {}, imposta: api().impostaPreferenze };
}

/** Impostazioni dell'app (#368), nello stesso file delle preferenze: `dati`, `imposta(parte)` (null toglie); si aggiornano da sole. */
export function useImpostazioni() {
  const c = useChiamata(() => api().impostazioni(), []);
  const [dal, setDal] = useState<Record<string, unknown> | null>(null);
  useEffect(() => api().onImpostazioni(setDal), []);
  return { stato: c.stato, errore: c.errore, riprova: c.riprova, dati: dal ?? c.dati ?? {}, imposta: api().impostaImpostazioni };
}
