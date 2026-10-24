// Chat di una sessione dell'app Claude che gira su una macchina SSH (#1001): il motore porta la trascrizione sul Mac (`trascrizione_remota`).
// All'apertura se manca la copia; con la sessione al lavoro ogni pochi secondi (solo a chat aperta) per la coda nuova. L'elenco legge la copia da sé (elenco.ts).
import { useCallback, useEffect, useState } from "react";
import type { Sessione } from "../../tipi";
import { comandaEsito } from "./clotch-ai";
import { erroreComando } from "./testi";

export const RITMO_REMOTA_MS = 5000;

/** attesa: il motore non ha ancora risposto e non c'è una copia da leggere; rifiuto: il suo testo, per lo stato d'errore con «Riprova». */
export function useTrascrizioneRemota(s: Sessione | null, vivo: boolean, rileggi: () => void) {
  const chat = s?.id ?? null, id = s?.idApp ?? null, remota = !!id && !!s?.app?.ospite, copia = !!s?.file.endsWith(".jsonl");
  const [esito, setEsito] = useState<{ chat: string; rifiuto: string | null } | null>(null);
  const [giro, setGiro] = useState(0);
  useEffect(() => {
    if (!chat || !remota || (copia && !vivo)) return; // copia già sul Mac e sessione ferma: nessuna chiamata
    let attivo = true, t: ReturnType<typeof setTimeout> | undefined;
    const chiama = async () => {
      const e = await comandaEsito("trascrizione_remota", { sessione: id });
      if (!attivo) return;
      if (e?.esito === "ok") {
        setEsito({ chat, rifiuto: null });
        if (!copia) rileggi(); // l'elenco ha già la copia (main: copiaRemota): si rilegge la chat
        if (vivo) t = setTimeout(chiama, RITMO_REMOTA_MS);
      } else setEsito({ chat, rifiuto: erroreComando(e) }); // rifiutato o caduto: si riparte solo da «Riprova»
    };
    void chiama();
    return () => { attivo = false; clearTimeout(t); };
  }, [chat, id, remota, copia, vivo, giro]);
  const mio = esito?.chat === chat ? esito : null;
  return { attesa: remota && !copia && !mio, rifiuto: mio?.rifiuto ?? null, riprova: useCallback(() => { setEsito(null); setGiro((n) => n + 1); }, []) };
}
