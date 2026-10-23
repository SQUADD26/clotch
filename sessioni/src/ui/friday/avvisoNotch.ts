// figma: 101-48368 — «Avviso mandato anche al notch»: un avviso di Friday che Clotch ha detto (`detto_da: clotch`) compare anche nell'app.
// Le risposte alle domande di Roberto non sono avvisi: stanno nella chat e basta. La prima lettura del registro non conta (storico).
import { useEffect, useRef } from "react";
import { avvisa } from "../base/Avvisi";
import { useNavigazione } from "../base/navigazione";
import { provaDi } from "../chat/testi";
import { useRegistro } from "./dati";

export const avvisoNotch = () => avvisa({ tipo: "info", messaggio: "Avviso mandato anche al notch" });

export function useAvvisoNotch() {
  const { dati: r } = useRegistro();
  const { sezione } = useNavigazione();
  const visti = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!r) return;
    const nuovi = visti.current ? r.avvisi.filter((a) => !visti.current!.has(a.id)) : [];
    visti.current = new Set(r.avvisi.map((a) => a.id));
    if (nuovi.some((a) => a.dettoDa === "clotch" && a.motivo !== "risposta")) avvisoNotch();
  }, [r]);
  // scena di prova 101:48368: il toast parte da solo
  useEffect(() => { if (provaDi(sezione, "avviso-notch") !== null) avvisoNotch(); }, [sezione]);
}
