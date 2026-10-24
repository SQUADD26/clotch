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
    // shortcut: il lettore dà solo `fatta`; «in corso» e «fallita» compaiono quando il registro li scrive (tipi.ts Prova).
    prove: (o?.prove ?? []).map((p) => ({ testo: p.testo, stato: p.fatta ? "fatta" : "attesa" })),
    file: info?.file ?? null,
  };
}

/** `esteso`: il bottone «Pannello» è premuto e sotto l'obiettivo ci sono le schede di Info sessione. */
export function PannelloInfo({ s, esteso }: { s: Sessione; esteso: boolean }) {
  const info = useInfo(s.id);
  const max = useChatClotchAi(s.id)?.contestoMax ?? null;
  const pr = s.app?.prs.at(-1);
  // scena di prova «scorrendo» (101:34190): il pannello parte già scorso di tanti px
  const scorri = Number(provaDi(useNavigazione().sezione, "scorri"));
  const colonna = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (scorri && colonna.current) colonna.current.scrollTop = scorri; }, [scorri, info]);
  return (
    <div className="pannello-info" ref={colonna}>
      <PannelloObiettivo dati={datiPannello(s, info)} />
      {esteso && <>
        <Ambiente s={s} />
        {info?.contesto != null && <Contesto usati={info.contesto} max={max} mcp={s.app?.strumentiMcp ?? 0} />}
        {!!s.app?.connettori.length && <Connettori nomi={s.app.connettori} />}
        {info && (info.file.quanti > 0 || pr) && <Modifiche file={info.file} pr={pr} />}
      </>}
    </div>
  );
}
