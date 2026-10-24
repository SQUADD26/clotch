// figma: 101-48368, 101-48405 — «Avviso mandato anche al notch»: un avviso di clotch AI che Clotch ha detto (`detto_da: clotch`) compare anche nell'app.
// Le risposte alle domande di Roberto non sono avvisi: stanno nella chat e basta. La prima lettura del registro non conta (storico).
import { useEffect, useRef } from "react";
import { avvisa } from "../base/Avvisi";
import { useNavigazione } from "../base/navigazione";
import { useImpostazioni } from "../impostazioni/stato";
import { provaDi } from "../chat/testi";
import { useRegistro } from "./dati";

export const avvisoNotch = () => avvisa({ tipo: "info", messaggio: "Avviso mandato anche al notch" });
const avvisoChiesto = (titolo: string, apri: () => void) => avvisa({ tipo: "info", messaggio: `${titolo} aspetta un permesso`, azione: { etichetta: "Apri", fai: apri } });

export function useAvvisoNotch() {
  const { dati: r } = useRegistro();
  const { sezione, apri } = useNavigazione();
  const attivo = useImpostazioni().clotchAvvisi; // «Avvisi nel notch» (Impostazioni › Clotch)
  const visti = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!r) return;
    const nuovi = visti.current ? r.avvisi.filter((a) => !visti.current!.has(a.id)) : [];
    visti.current = new Set(r.avvisi.map((a) => a.id));
    if (attivo && nuovi.some((a) => a.dettoDa === "clotch" && a.motivo !== "risposta")) avvisoNotch();
    // un permesso chiesto da una sessione e non detto dal notch: toast con «Apri» sulla sessione
    for (const a of nuovi) if (a.motivo === "chiesto" && a.dettoDa !== "clotch" && a.sessioni[0]) avvisoChiesto(`«${r.chat.get(a.sessioni[0])?.titolo ?? "Una sessione"}»`, () => apri("sessione", a.sessioni[0]));
  }, [r, attivo, apri]);
  // scena di prova 101:48368: il toast parte da solo
  useEffect(() => {
    if (provaDi(sezione, "avviso-notch") !== null) avvisoNotch();
    if (provaDi(sezione, "avviso-chiesto") !== null) avvisoChiesto("Backend: auth e RLS", () => {});
  }, [sezione]);
}
