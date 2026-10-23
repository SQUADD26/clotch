// La chat e Friday: registro dal vivo (canale `friday:registro`) e comandi nella casella (contratto v1, «Comandi»).
// Esito non riuscito: l'avviso unico «Sessione non raggiunta» con «Riprova» (frame 101:24007).
import { useEffect, useState } from "react";
import type { ChatFriday, Registro } from "../../friday";
import type { FridayApi } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { daPiano } from "../friday/registro";

const friday = () => (window as unknown as { friday: FridayApi }).friday;

/** Registro di Friday, aggiornato a ogni riga nuova; null finché non arriva o se il canale non risponde. */
export function useRegistro(): Registro | null {
  const [r, setR] = useState<Registro | null>(null);
  useEffect(() => {
    let vivo = true;
    friday().registro().then((p) => vivo && setR(daPiano(p)), () => {});
    const via = friday().onRegistro((p) => setR(daPiano(p)));
    return () => { vivo = false; via(); };
  }, []);
  return r;
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

/** Manda un comando a Friday. true = fatto; altrimenti avviso con «Riprova». */
export async function comanda(cmd: Parameters<FridayApi["comando"]>[0], args: Record<string, unknown>): Promise<boolean> {
  const e = await friday().comando(cmd, args).catch(() => null);
  if (e?.esito === "ok") return true;
  avvisa({ tipo: "errore", messaggio: "Sessione non raggiunta", azione: { etichetta: "Riprova", fai: () => void comanda(cmd, args) } });
  return false;
}
