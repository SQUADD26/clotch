// figma: 101-38901 — righe di clotch AI nella barra: «Riga clotch AI» (Attiva 101:7728,
// In pausa 101:38901, Spenta 101:42004), voci Casella, Decisioni, Regole (101:42004), sotto la banda «Non disturbare» (101:39071). Dati: registro di clotch AI (src/ui/clotch-ai).
import type { Registro } from "../../clotch-ai";
import { useRegistro as useRegistroUnico } from "../clotch-ai/dati";
import { Icona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { casella, statoClotchAi, type StatoClotchAi } from "../clotch-ai/vista";
import { RigaComando } from "./Righe";
import { ViaDalMac } from "./ViaDalMac";

declare global {
  interface Window { clotchAi: import("../../tipi").ClotchAiApi }
}

const STATO: Record<StatoClotchAi, { testo: string; classe: string }> = {
  attiva: { testo: "Attiva", classe: "successo" },
  pausa: { testo: "In pausa", classe: "secondario" },
  spenta: { testo: "Spenta", classe: "errore" },
};

/** Registro di clotch AI, aggiornato dal vivo; null finché non arriva o se non si legge. */
export function useRegistro(): Registro | null {
  return useRegistroUnico().dati ?? null; // lo stesso negozio delle viste di clotch AI: un evento si legge una volta sola
}

const ora = (t: number) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

export function NonDisturbare({ nd }: { nd: NonNullable<Registro["nonDisturbare"]> }) {
  return (
    <div className="banda">
      <div className="riga-banda">
        <Icona nome="luna" colore="accento" />
        <span className="titolo t-sm medio">{nd.fino === null ? "Non disturbare" : `Non disturbare fino alle ${ora(nd.fino)}`}</span>
        <button type="button" className="t-sm medio" onClick={() => window.clotchAi.comando("non_disturbare", { acceso: false })}>Rimuovi</button>
      </div>
      <span className="dettaglio t-xs secondario">{nd.tenuti} avvisi tenuti per dopo</span>
    </div>
  );
}

export function RigheClotchAi({ r, adesso, pagina }: { r: Registro | null; adesso: number; pagina: string }) {
  const n = useNavigazione();
  const stato = r ? STATO[statoClotchAi(r, adesso).stato] : null;
  const aspettano = r ? casella(r, adesso).aspettano : 0;
  return (
    <>
      <button type="button" className={`riga riga-clotch-ai ${pagina === "clotch-ai" ? "scelta" : ""}`} onClick={() => n.apri("clotch-ai")}>
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
