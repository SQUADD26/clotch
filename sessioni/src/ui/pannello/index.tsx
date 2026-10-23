// figma: 101-8010 — pannello destro della sessione aperta (#350): obiettivo (stati 113-51111) e le schede di «Info sessione» 101-33775. Se torna null la colonna si allarga.
import { useElenco } from "../base/dati";
import { useNavigazione } from "../base/navigazione";
import { PannelloInfo } from "./PannelloInfo";
import { scene } from "./scene";

export { PillolaClotch, PillolaSchermoOccupato, useClotchAcceso } from "./Pillole";
export { clotchAcceso, suClotch } from "./clotch";
export { scene };

export default function Pannello() {
  const { sessione, pannelloInfo } = useNavigazione();
  const elenco = useElenco();
  const s = elenco.dati?.sessioni.find((x) => x.id === sessione);
  // caricamento ed errore dell'elenco li mostra la chat; senza sessione il pannello non ha niente da dire
  return s ? <PannelloInfo s={s} esteso={pannelloInfo} /> : null;
}
