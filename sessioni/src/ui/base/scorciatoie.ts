// Un solo gestore dei tasti per l'app: legge le scorciatoie salvate e fa l'azione. Le azioni che stanno dentro un pezzo
// (consenti, nega, ferma) il pezzo le registra con `registraAzione`; quelle di navigazione le fa il gestore.
import { useEffect } from "react";
import { useImpostazioni } from "../impostazioni/stato";
import { azioneDi, tastiDi } from "../impostazioni/tasti";
import { useApriSessione } from "../barra/apri";
import { useAvvio } from "./Avvio";
import { useElenco } from "./dati";
import { useNavigazione } from "./navigazione";
import { prossimaInAttesa } from "./prossima";

const azioni = new Map<string, () => void>();

/** Il pezzo dà la sua funzione per `azione` finché è montato e può farla; ritorna come toglierla. */
export function registraAzione(azione: string, fai: () => void): () => void {
  azioni.set(azione, fai);
  return () => { if (azioni.get(azione) === fai) azioni.delete(azione); };
}

const inCampo = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Da montare una volta, dentro la navigazione. */
export function useScorciatoie() {
  const n = useNavigazione();
  const { scorciatoie } = useImpostazioni();
  const apriSessione = useApriSessione();
  const avvio = useAvvio();
  const sessioni = useElenco().dati?.sessioni;
  useEffect(() => {
    const premi = (e: KeyboardEvent) => {
      // già gestito (la pagina Scorciatoie che registra, la casella); nei campi di testo solo le combinazioni con ⌘
      if (avvio || e.defaultPrevented || e.repeat || (inCampo(e.target) && !e.metaKey)) return;
      if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey && e.key.toLowerCase() === "n") { e.preventDefault(); n.apri("nuova-sessione"); return; } // «Nuova sessione» ⌘N, fisso
      const a = azioneDi(tastiDi(e), scorciatoie);
      const navigazione: Record<string, () => void> = { clotchAi: () => n.apri("clotch-ai"), barra: n.alternaBarra, indietro: n.indietro, avanti: n.avanti, impostazioni: () => n.apri("impostazioni"),
        prossima: () => { const id = prossimaInAttesa(sessioni ?? [], n.sessione); if (id) apriSessione(id); } };
      const fai = a && (navigazione[a] ?? azioni.get(a));
      if (fai) { e.preventDefault(); fai(); }
    };
    addEventListener("keydown", premi);
    return () => removeEventListener("keydown", premi);
  }, [n, scorciatoie, sessioni, apriSessione, avvio]);
}
