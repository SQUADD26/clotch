// Un punto solo dove il testo arriva alla vista: le due impostazioni «Dati» valgono per ogni blocco che lo usa.
import { useImpostazioni } from "../impostazioni/stato";
import { copriChiavi, nomeComando } from "./chiavi";

export function useRiserva() {
  const v = useImpostazioni();
  const testo = (t: string) => (v.nascondiChiavi ? copriChiavi(t) : t);
  /** Un comando eseguito: intero o solo il nome, poi le chiavi coperte. */
  const comando = (c: string) => testo(v.comandiInteri ? c : nomeComando(c));
  return { testo, comando };
}
