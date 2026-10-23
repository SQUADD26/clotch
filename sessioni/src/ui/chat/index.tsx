// figma: 101-7873 — punto di montaggio della chat (#349): `Intestazione` sopra, `Chat` nella colonna centrale (101:8036, 101:8610).
// Vuota 101:9841; caricamento ed errore coi pezzi della base. Friday monta `FiloFriday` e `CasellaFriday`.
import { useMemo } from "react";
import { api, useElenco, useMessaggi, usePreferenze } from "../base/dati";
import { useNavigazione } from "../base/navigazione";
import { MessaggioAlCentro, Sagome, StatoErrore } from "../base/Stati";
import { Casella } from "./Casella";
import { Filo } from "./Filo";
import { nonRisponde, useChatFriday, useOra } from "./friday";
import { TestaSessione } from "./Intestazione";
import { Limite, NonRisponde } from "./Lavoro";
import { voci as daMessaggi, type Voce } from "./modello";
import { daQuanto, nomeAccount, ora as orario } from "./testi";

export { CasellaFriday, FiloFriday } from "./FiloFriday";

/** L'ultimo messaggio di Roberto segue un turno interrotto: ha appena usato «interrompi e manda». */
function dopoInterruzione(voci: Voce[]) {
  const k = voci.map((v) => v.tipo).lastIndexOf("roberto"), prima = voci[k - 1];
  return prima?.tipo === "turno" && prima.blocchi.at(-1)?.tipo === "interrotta";
}

function useSessione() {
  const { sessione, sezione } = useNavigazione();
  const elenco = useElenco();
  return { elenco, sezione, s: elenco.dati?.sessioni.find((x) => x.id === sessione) ?? null };
}

export function Intestazione() {
  const { s } = useSessione();
  const p = usePreferenze().dati;
  const c = useChatFriday(s?.id ?? null);
  const adesso = useOra();
  if (!s) return null;
  return <TestaSessione s={s} nonRisponde={!!c && nonRisponde(c, adesso)} pref={p[s.id]} />;
}

export default function Chat() {
  const { elenco, s, sezione } = useSessione();
  const m = useMessaggi(s?.id ?? null);
  const c = useChatFriday(s?.id ?? null);
  const adesso = useOra();
  const vivo = s?.stato === "lavora" && s.situazione?.adesso !== "turno_finito";
  const voci = useMemo(() => daMessaggi(m.messaggi, vivo, s?.cartella), [m.messaggi, vivo, s?.cartella]);

  if (elenco.stato === "carica" || (s && m.stato === "carica")) return <Sagome />;
  if (elenco.stato === "errore" && !s) return <StatoErrore titolo="Sessioni non lette" corpo={elenco.errore} riprova={elenco.riprova} />;
  if (!s) return null;
  if (m.stato === "errore") return <StatoErrore titolo="Messaggi non letti" corpo={m.errore ?? ""} riprova={m.riprova} />;

  const muta = !!c && nonRisponde(c, adesso);
  const limite = s.situazione?.adesso === "limite" || !!c?.limite;
  const ripartenza = c?.limite?.ripartenza != null ? orario(c.limite.ripartenza) : null;
  const inFondo = muta
    ? <NonRisponde da={daQuanto(c.battito ?? 0, adesso)} terminale={() => void api().azione(s.id, "apri-terminale")} />
    : limite ? <Limite account={nomeAccount(c?.limite?.account ?? s.account)} ripartenza={ripartenza} /> : null;
  const casella = (
    <Casella chat={s.id} lavora={vivo && !muta} coda={c?.coda ?? []} modello={s.modello} disabilitata={s.sorgente === "cursor"} prova={sezione}
      appenaMandato={dopoInterruzione(voci)}
      segnaposto={muta ? "In attesa della sessione" : limite && ripartenza ? `Riparte alle ${ripartenza}` : undefined} />
  );

  if (!m.messaggi.length) {
    return (
      <>
        <div className="filo vuoto"><MessaggioAlCentro titolo="Nessun messaggio" corpo="La sessione è aperta ma non ha ancora messaggi." /></div>
        {casella}
      </>
    );
  }
  return (
    <>
      <Filo voci={voci} chat={s.id} vivo={vivo && !muta} finita={s.stato === "finita"} c={c}
        da={s.stato === "aspetta" ? daQuanto(s.ultimaAttivita, adesso) : null}
        prima={m.haAltre ? (m.totale != null ? m.totale - m.messaggi.length : null) : false}
        altri={() => void m.altri()} altriCarica={m.altriCarica} inFondo={inFondo} prova={sezione} />
      {casella}
    </>
  );
}
