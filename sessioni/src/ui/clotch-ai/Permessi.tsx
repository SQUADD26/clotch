// figma: 101-37492 — «Richiesta permesso» dentro il filo di clotch AI: ogni permesso aperto di una sessione viva, col suo titolo,
// da quanto aspetta e i tre bottoni. Le risposte sono i comandi `rispondi_permesso` della carta della chat (una sola, non una copia).
import { useElenco } from "../base/dati";
import { Pezzo } from "../base/Pezzo";
import { useOra } from "../chat/clotch-ai";
import { Permesso } from "../chat/Richieste";
import { daQuanto } from "../chat/testi";
import { useRegistro } from "./dati";

/** Permessi ancora aperti delle sessioni vive (non quella di clotch AI, non quelle finite). */
export function usePermessi() {
  const { dati: r } = useRegistro();
  const elenco = useElenco().dati?.sessioni ?? [];
  const ora = useOra();
  return [...(r?.chat.values() ?? [])].filter((c) => !c.fine && c.chat !== "friday" && c.chat !== "terminale").flatMap((c) => { // nome del protocollo del motore
    const s = elenco.find((x) => x.id === c.chat);
    return c.richieste.filter((q) => q.genere === "permesso").map((q) => ({
      chat: c.chat, r: q, titolo: `${c.titolo ?? s?.titolo ?? c.chat} chiede un permesso`, da: s ? daQuanto(s.ultimaAttivita, ora) : null,
    }));
  });
}

export function Permessi({ permessi }: { permessi: ReturnType<typeof usePermessi> }) {
  return <Pezzo nome="chat">{permessi.map((p) => <Permesso key={`${p.chat}:${p.r.rid}`} chat={p.chat} r={p.r} da={p.da} titolo={p.titolo} />)}</Pezzo>;
}
