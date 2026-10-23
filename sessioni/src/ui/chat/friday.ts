// La chat e Friday: registro dal vivo (canale `friday:registro`) e comandi nella casella (contratto v1, «Comandi»).
// Esito non riuscito: l'avviso unico «Sessione non raggiunta» con «Riprova» (frame 101:24007).
import { useEffect, useState } from "react";
import type { ChatFriday } from "../../friday";
import type { FridayApi } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { friday, useRegistro } from "../friday/dati";
import { erroreComando } from "./testi";

/** La chat di Friday di una sessione (permessi, domande, coda, battito); null se Friday non la conosce o il registro manca. */
export function useChatFriday(id: string | null): ChatFriday | null {
  const { dati } = useRegistro();
  return (id && dati?.chat.get(id)) || null;
}

/** Ora che scorre, per «da 2 min» e «non risponde». */
export function useOra(ogniMs = 30_000) {
  const [ora, setOra] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setOra(Date.now()), ogniMs); return () => clearInterval(t); }, [ogniMs]);
  return ora;
}

// stessa regola di `nonRisponde` in src/friday.ts (lì non si importa: quel file usa node:fs)
const NON_RISPONDE_MS = 180_000;
export const nonRisponde = (c: ChatFriday, ora: number) => c.stato === "lavora" && !c.fine && ora - (c.battito ?? 0) > NON_RISPONDE_MS;

/** Manda un comando a Friday e dà l'esito intero (null = il canale verso il motore è caduto), senza avvisi: chi lo usa mostra il perché da sé. */
export const comandaEsito = (cmd: Parameters<FridayApi["comando"]>[0], args: Record<string, unknown>) => friday().comando(cmd, args).catch(() => null);

/** Manda un comando a Friday. true = fatto; altrimenti avviso con «Riprova». */
export async function comanda(cmd: Parameters<FridayApi["comando"]>[0], args: Record<string, unknown>): Promise<boolean> {
  const e = await comandaEsito(cmd, args);
  if (e?.esito === "ok") return true;
  // rifiutato dal motore: riprovare darebbe lo stesso rifiuto, si mostra il suo testo senza «Riprova»
  avvisa({ tipo: "errore", messaggio: erroreComando(e), azione: e?.esito === "rifiutato" ? undefined : { etichetta: "Riprova", fai: () => void comanda(cmd, args) } });
  return false;
}
