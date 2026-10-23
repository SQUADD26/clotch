// L'unico punto in cui l'elenco apre una sessione (#409): secondo «Apri una sessione» delle impostazioni, qui o in una nuova finestra.
import { avvisa } from "../base/Avvisi";
import { api, messaggioErrore } from "../base/dati";
import { useNavigazione } from "../base/navigazione";
import { IN_NUOVA_FINESTRA, useImpostazioni } from "../impostazioni/stato";

export function useApriSessione() {
  const n = useNavigazione();
  const { apriSessione } = useImpostazioni();
  return (id: string) => apriSessione === IN_NUOVA_FINESTRA
    ? api().azione(id, "nuova-finestra").catch((e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }))
    : n.apri("sessione", id);
}
