// figma: 101-38901 — righe di Friday nella barra: «Riga Friday» (Attiva 101:7728,
// In pausa 101:38901, Spenta 101:42004), voci Casella, Decisioni, Regole (101:42004), sotto la banda «Non disturbare» (101:39071). Dati: registro di Friday (src/ui/friday).
import { useEffect, useState } from "react";
import type { Registro } from "../../friday";
import { useChiamata } from "../base/dati";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { daPiano } from "../friday/registro";
import { casella, statoFriday, type StatoFriday } from "../friday/vista";
import { RigaComando } from "./Righe";
import { ViaDalMac } from "./ViaDalMac";

declare global {
  interface Window { friday: import("../../tipi").FridayApi }
}

const STATO: Record<StatoFriday, { testo: string; classe: string }> = {
  attiva: { testo: "Attiva", classe: "successo" },
  pausa: { testo: "In pausa", classe: "secondario" },
  spenta: { testo: "Spenta", classe: "errore" },
};

/** Registro di Friday, aggiornato dal vivo; null finché non arriva o se non si legge. */
export function useRegistro(): Registro | null {
  const c = useChiamata(async () => daPiano(await window.friday.registro()), []);
  const [vivo, setVivo] = useState<Registro | null>(null);
  useEffect(() => window.friday.onRegistro((r) => setVivo(daPiano(r))), []);
  return vivo ?? c.dati ?? null;
}

const ora = (t: number) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

export function NonDisturbare({ nd }: { nd: NonNullable<Registro["nonDisturbare"]> }) {
  return (
    <div className="banda">
      <div className="riga-banda">
        <Icona nome="luna" colore="accento" />
        <span className="titolo t-sm medio">{nd.fino === null ? "Non disturbare" : `Non disturbare fino alle ${ora(nd.fino)}`}</span>
        <button type="button" className="t-sm medio" onClick={() => window.friday.comando("non_disturbare", { acceso: false })}>Togli</button>
      </div>
      <span className="dettaglio t-xs secondario">{nd.tenuti} avvisi tenuti per dopo</span>
    </div>
  );
}

export function RigheFriday({ r, adesso, pagina }: { r: Registro | null; adesso: number; pagina: string }) {
  const n = useNavigazione();
  const stato = r ? STATO[statoFriday(r, adesso).stato] : null;
  const aspettano = r ? casella(r, adesso).aspettano : 0;
  return (
    <>
      <button type="button" className={`riga riga-friday ${pagina === "friday" ? "scelta" : ""}`} onClick={() => n.apri("friday")}>
        <Icona nome="scintille" colore="accento" />
        <span className="testo medio">clotch AI</span>
        {stato && <span className={`lato t-xs stato-${stato.classe}`}>{stato.testo}</span>}
      </button>
      <RigaComando icona="posta" etichetta="Casella" lato={aspettano ? String(aspettano) : undefined} scelta={pagina === "casella"} onClick={() => n.apri("casella")} />
      <RigaComando icona="libro" etichetta="Decisioni" scelta={pagina === "decisioni"} onClick={() => n.apri("decisioni")} />
      <RigaComando icona="scudo" etichetta="Regole" scelta={pagina === "regole"} onClick={() => n.apri("regole")} />
      {r?.nonDisturbare && (r.nonDisturbare.fino === null || r.nonDisturbare.fino > adesso) && <NonDisturbare nd={r.nonDisturbare} />}
      <ViaDalMac r={r} adesso={adesso} aspettano={aspettano} inCasella={pagina === "casella"} />
    </>
  );
}
