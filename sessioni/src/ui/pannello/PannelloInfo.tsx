// figma: 101-33775 — «Info sessione» (101:34190 scorrendo): la colonna destra, schede una sotto l'altra, che scorre.
import { useLayoutEffect, useRef } from "react";
import type { InfoSessione, Sessione } from "../../tipi";
import { useNavigazione } from "../base/navigazione";
import { useChatClotchAi } from "../chat/clotch-ai";
import { provaDi } from "../chat/testi";
import { useInfo } from "./info";
import { PannelloObiettivo, type DatiPannello } from "./PannelloObiettivo";
import { Ambiente, Connettori, Contesto, Modifiche } from "./SchedeInfo";

/** Dalla sessione ai dati della scheda obiettivo. Obiettivo non firmato (`valido: false`) = nessun obiettivo, come chiede il registro. */
export function datiPannello(s: Sessione, info: InfoSessione | null): DatiPannello {
  const o = s.obiettivo?.valido ? s.obiettivo : null;
  return {
    obiettivo: o?.testo ?? null,
    stato: o?.stato ?? null,
    // shortcut: «in corso» il registro non lo scrive (le prove girano senza segno): compare quando lo scriverà (`provando` in obiettivo_vivo.riprova).
    prove: (o?.prove ?? []).map((p) => ({ testo: p.testo, stato: p.fatta ? "fatta" : p.fallita ? "fallita" : "attesa" })),
    file: info?.file ?? null,
  };
}

/** Obiettivo e, sotto, le schede di Info sessione: il pannello è aperto o chiuso, senza stati in mezzo. */
export function PannelloInfo({ s }: { s: Sessione }) {
  const { info, errore, riprova } = useInfo(s.id);
  const max = useChatClotchAi(s.id)?.contestoMax ?? null;
  const prs = info?.prs ?? s.app?.prs ?? [];
  // scena di prova «scorrendo» (101:34190): il pannello parte già scorso di tanti px
  const scorri = Number(provaDi(useNavigazione().sezione, "scorri"));
  const colonna = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (scorri && colonna.current) colonna.current.scrollTop = scorri; }, [scorri, info]);
  return (
    <div className="pannello-info" ref={colonna}>
      <PannelloObiettivo dati={datiPannello(s, info)} />
      <>
        <Ambiente s={s} />
        {errore && !info && <div className="scheda errore-info" role="alert"><span className="t-sm errore">Non riesco a leggere contesto e modifiche.</span><button type="button" className="bottone secondario" onClick={riprova}>Riprova</button></div>}
        {!errore && !info && <div className="scheda scheletro" aria-busy="true" aria-label="Carico contesto e modifiche"><span className="riga-sagoma" /><span className="riga-sagoma corta" /></div>}
        {info?.contesto != null && <Contesto usati={info.contesto} max={max} mcp={s.app?.strumentiMcp ?? 0} />}
        {!!s.app?.connettori.length && <Connettori nomi={s.app.connettori} />}
        {info && (info.file.quanti > 0 || prs.length > 0) && <Modifiche file={info.file} prs={prs} />}
      </>
    </div>
  );
}
