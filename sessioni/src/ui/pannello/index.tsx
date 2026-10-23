// figma: 101-8010 — pannello destro della sessione aperta (#350); stati nel frame 113-51111. Se torna null la colonna si allarga.
import type { Sessione } from "../../tipi";
import { useElenco } from "../base/dati";
import { useNavigazione } from "../base/navigazione";
import { PannelloObiettivo, type DatiPannello } from "./PannelloObiettivo";
import { scene } from "./scene";

export { PillolaClotch, PillolaSchermoOccupato, useClotchAcceso } from "./Pillole";
export { clotchAcceso, suClotch } from "./clotch";
export { PillolaClotch as ComandiTitolo } from "./Pillole";
export { CentroTitolo } from "./Schermo";
export { scene };

/** Dalla sessione ai dati del pannello. Obiettivo non firmato (`valido: false`) = nessun obiettivo, come chiede il registro. */
export function datiPannello(s: Sessione): DatiPannello {
  const o = s.obiettivo?.valido ? s.obiettivo : null;
  return {
    obiettivo: o?.testo ?? null,
    // shortcut: il lettore dà solo `fatta`; «in corso» e «fallita» compaiono quando il registro li scrive (tipi.ts Prova).
    prove: (o?.prove ?? []).map((p) => ({ testo: p.testo, stato: p.fatta ? "fatta" : "attesa" })),
    // shortcut: il lettore non dà ancora i file toccati; la sezione torna quando Sessione li porta.
    file: null,
  };
}

export default function Pannello() {
  const { sessione } = useNavigazione();
  const elenco = useElenco();
  const s = elenco.dati?.sessioni.find((x) => x.id === sessione);
  // caricamento ed errore dell'elenco li mostra la chat; senza sessione il pannello non ha niente da dire
  return s ? <PannelloObiettivo dati={datiPannello(s)} /> : null;
}
