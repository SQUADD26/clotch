// L'unico modo per parlare col processo main: window.sessioni (preload.ts), avvolto in hook con stato carica/pronto/errore.
// Schema dal vault (Research/App/ChatGPT): rete-e-api.md § «Dal vivo»: il renderer non fa rete, chiede al main via IPC e
// riceve gli eventi; esperienza-uso.md § «Stati»: i nuovi tentativi stanno nel main, il renderer offre solo «Riprova».
// Un aggiornamento dal vivo ricarica in silenzio: i dati vecchi restano a schermo finché arrivano i nuovi.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Aggiornamento, Elenco, Messaggio, PreferenzeSessione, SessioniApi } from "../../tipi";

import { applicaDelta, applicaPagina, fallita, nuovaCronologia, righeOrdinate, type CronologiaStato } from "./cronologia-stato";

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

// Il main è fidato ma un suo dato storto non deve abbattere il render: si scarta qui, al confine, e il resto resta usabile.
const oggetto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object";
const sono = (o: Record<string, unknown>, tipo: string, ...campi: string[]) => campi.every((k) => typeof o[k] === tipo);
const sessioneValida = (s: unknown) => oggetto(s) && sono(s, "string", "id", "titolo", "progetto", "account", "cartella") && Number.isFinite(s.ultimaAttivita);
export const messaggioValido = (m: unknown): m is Messaggio => oggetto(m) && (m.tipo === "strumento"
  ? sono(m, "string", "id", "nome") && (m.esito == null || (oggetto(m.esito) && sono(m.esito, "string", "testo")))
  : ["utente", "assistente", "pensiero", "errore"].includes(m.tipo as string) && sono(m, "string", "testo"));

/** Elenco con la forma controllata: `sessioni` non è un array = errore con «Riprova»; le sessioni storte si scartano. */
export function elencoValido(e: unknown): Elenco {
  if (!oggetto(e) || !Array.isArray(e.sessioni)) throw new Error("Elenco delle sessioni non valido.");
  return { sessioni: e.sessioni.filter(sessioneValida), errori: Array.isArray(e.errori) ? e.errori.filter((x) => oggetto(x) && sono(x, "string", "percorso", "messaggio")) : [] };
}

/** Ascolta gli aggiornamenti dal vivo del main (file delle sessioni cambiati). */
export function useAggiornamenti(cb: (a: Aggiornamento) => void) {
  const ultimo = useRef(cb);
  ultimo.current = cb;
  useEffect(() => api().onAggiornamento((a) => { if (oggetto(a)) ultimo.current(a); }), []);
}

/** Elenco delle sessioni, ricaricato in silenzio quando una cambia. `dati.errori` = cartelle non lette. */
export function useElenco() {
  const c = useChiamata<Elenco>(() => api().elencoSessioni().then(elencoValido), []);
  useAggiornamenti((a) => { if (Array.isArray(a.sessioni) && a.sessioni.length) c.ricarica(); });
  const pref = usePreferenze().dati;
  // «Rinomina…» (#460): il nome dato in clotch prende il posto del titolo ovunque l'app lo mostra; il file della sessione non cambia
  const dati = useMemo(() => c.dati && { ...c.dati, sessioni: c.dati.sessioni.map((s) => (pref[s.id]?.nome ? { ...s, titolo: pref[s.id].nome! } : s)) }, [c.dati, pref]);
  return { ...c, dati } as typeof c;
}

/** Snapshot immutabile e delta fisici; il listener precede sempre la prima richiesta. */
export function useMessaggi(id: string | null) {
  const [dati, setDati] = useState(() => nuovaCronologia(id));
  const [carica, setCarica] = useState(true);
  const [altriCarica, setAltriCarica] = useState(false);
  const [altriErrore, setAltriErrore] = useState<string | null>(null);
  const stato = useRef(dati), corrente = useRef(id), giro = useRef(0);
  const precedente = useRef<object | null>(null);
  if (corrente.current !== id) {
    corrente.current = id; giro.current++; precedente.current = null;
  }
  const pubblica = (s: CronologiaStato) => { stato.current = s; setDati(s); };
  const riprova = useCallback(() => {
    if (corrente.current !== id) return;
    const mio = ++giro.current;
    precedente.current = null; setAltriCarica(false); setAltriErrore(null);
    const prima = stato.current;
    pubblica({ ...nuovaCronologia(id), righe: prima.sessione === id ? prima.righe : new Map() });
    setCarica(!!id);
    if (!id) return;
    api().messaggi(id, 0, { v: 1 }).then((p) => {
      if (mio !== giro.current || corrente.current !== id) return;
      pubblica(applicaPagina(stato.current, p));
    }).catch((e) => {
      if (mio === giro.current && corrente.current === id) pubblica(fallita(stato.current, messaggioErrore(e)));
    }).finally(() => {
      if (mio === giro.current && corrente.current === id) setCarica(false);
    });
  }, [id]);
  useEffect(() => {
    // Nessun fallback alle pagine numeriche: una risposta senza v1 è un errore visibile.
    let attivo = true;
    const stop = api().onAggiornamento((a) => {
      if (!attivo || corrente.current !== id || !oggetto(a) || !Array.isArray(a.cronologia)) return;
      let s = stato.current;
      for (const d of a.cronologia) if (oggetto(d)) s = applicaDelta(s, d);
      if (s !== stato.current) pubblica(s);
    });
    riprova();
    return () => { attivo = false; stop(); giro.current++; precedente.current = null; };
  }, [id, riprova]);
  const altri = async () => {
    const s = stato.current;
    if (!id || corrente.current !== id || s.sessione !== id || precedente.current || !s.snapshot || !s.cursore || s.invalida || carica) return;
    const mio = giro.current, richiesta = {};
    precedente.current = richiesta; setAltriCarica(true); setAltriErrore(null);
    try {
      const p = await api().messaggi(id, s.pagina + 1, { v: 1, cursore: s.cursore });
      if (mio !== giro.current || corrente.current !== id || precedente.current !== richiesta) return;
      const prossimo = applicaPagina(stato.current, p);
      if (prossimo.errore) {
        setAltriErrore(prossimo.errore);
        pubblica({ ...prossimo, errore: null });
      } else pubblica(prossimo);
    } catch (e) {
      if (mio === giro.current && corrente.current === id && precedente.current === richiesta) setAltriErrore(messaggioErrore(e));
    } finally {
      if (mio === giro.current && corrente.current === id && precedente.current === richiesta) {
        precedente.current = null; setAltriCarica(false);
      }
    }
  };
  const s = dati.sessione === id ? dati : nuovaCronologia(id);
  const righe = righeOrdinate(s).filter((r) => messaggioValido(r.messaggio));
  return { stato: s.errore ? "errore" : carica || dati.sessione !== id ? "carica" : "pronto",
    errore: s.errore, riprova, messaggi: righe.map((r) => r.messaggio), identita: righe,
    pagina: s.pagina, haAltre: !!s.cursore && !s.invalida, totale: s.totale,
    altri, altriCarica, altriErrore, riprovaAltri: s.invalida ? riprova : altri };
}

const SENZA_PREFERENZE: Record<string, PreferenzeSessione> = {}; // stesso oggetto a ogni giro: chi lo ha nelle dipendenze non si rifà

/** Preferenze dell'app per sessione (#360): `dati[id]`, `imposta(id, parte)`; si aggiornano da sole quando cambiano. */
export function usePreferenze() {
  const c = useChiamata(() => api().preferenze(), []);
  const [dal, setDal] = useState<Record<string, PreferenzeSessione> | null>(null);
  useEffect(() => api().onPreferenze(setDal), []);
  return { stato: c.stato, errore: c.errore, riprova: c.riprova, dati: dal ?? c.dati ?? SENZA_PREFERENZE, imposta: api().impostaPreferenze };
}

/** Impostazioni dell'app (#368), nello stesso file delle preferenze: `dati`, `imposta(parte)` (null toglie); si aggiornano da sole. */
export function useImpostazioni() {
  const c = useChiamata(() => api().impostazioni(), []);
  const [dal, setDal] = useState<Record<string, unknown> | null>(null);
  useEffect(() => api().onImpostazioni(setDal), []);
  return { stato: c.stato, errore: c.errore, riprova: c.riprova, dati: dal ?? c.dati ?? {}, imposta: api().impostaImpostazioni };
}
