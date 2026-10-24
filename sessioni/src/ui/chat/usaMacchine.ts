// figma: 149-67470 — l'elenco delle macchine SSH del motore (comando `macchine`) per il menu e per «Nuova sessione».
import { useCallback, useEffect, useState } from "react";
import type { Macchina, Proposta } from "../../macchine-tipi";
import { comandaEsito } from "./clotch-ai";
import { motivoGuasto } from "./macchine";

export interface ElencoMacchine { macchine: Macchina[]; proposte: Proposta[]; errore: string | null; carica: boolean; ricarica(): void }

/** Le macchine del motore: base e aggiunte, e le connessioni di Claude Desktop da aggiungere. Lette all'apertura e a ogni `ricarica`. */
export function useMacchine(): ElencoMacchine {
  const [s, setS] = useState<Pick<ElencoMacchine, "macchine" | "proposte" | "errore" | "carica">>({ macchine: [], proposte: [], errore: null, carica: true });
  const ricarica = useCallback(() => {
    let vivo = true;
    void comandaEsito("macchine", {}).then((e) => vivo && setS(e?.esito === "ok"
      ? { macchine: e.macchine ?? [], proposte: e.proposte ?? [], errore: null, carica: false }
      : { macchine: [], proposte: [], errore: motivoGuasto(e), carica: false }));
    return () => { vivo = false; };
  }, []);
  useEffect(() => ricarica(), [ricarica]);
  return { ...s, ricarica };
}
