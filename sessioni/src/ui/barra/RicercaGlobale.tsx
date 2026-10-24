// figma: 101-10247 — la ricerca ⌘K vive nella finestra, non nella barra: si apre anche con la barra chiusa (#860).
import { useEffect, useSyncExternalStore } from "react";
import { api, useElenco, usePreferenze } from "../base/dati";
import { useNavigazione } from "../base/navigazione";
import { registraAzione } from "../base/scorciatoie";
import { useOra } from "../chat/clotch-ai";
import { useApriSessione } from "./apri";
import { prova } from "./prova";
import { Ricerca } from "./Ricerca";

let aperta = prova()?.ricerca !== undefined;
const ascoltatori = new Set<() => void>();
export function impostaRicerca(valore: boolean | ((x: boolean) => boolean)) {
  aperta = typeof valore === "function" ? valore(aperta) : valore;
  ascoltatori.forEach((f) => f());
}
export const useRicercaAperta = () => useSyncExternalStore((f) => { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; }, () => aperta);

export function RicercaGlobale() {
  const n = useNavigazione();
  const apriSessione = useApriSessione();
  const p = prova();
  const vivo = useElenco(), prefVive = usePreferenze(), ora = useOra();
  const sessioni = (p?.elenco ?? vivo).dati?.sessioni ?? [];
  const pagina = p?.pagina ?? n.vista;
  useEffect(() => registraAzione("cerca", () => impostaRicerca((x) => !x)), []);
  if (!useRicercaAperta()) return null;
  return (
    <Ricerca sessioni={sessioni} pref={p?.pref ?? prefVive.dati} aperta={pagina === "sessione" ? (p?.scelta ?? n.sessione) : null} ora={p?.ora ?? ora}
      iniziale={p?.ricerca} cerca={p ? async () => p.cercati ?? [] : undefined}
      onApri={apriSessione} onAzione={(id, a) => void api().azione(id, a)} onChiudi={() => impostaRicerca(false)} />
  );
}
