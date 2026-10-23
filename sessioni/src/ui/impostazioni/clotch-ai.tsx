// figma: 101-17538 — Impostazioni · clotch AI. Sono impostazioni di clotch AI, non dell'app: si leggono dall'ultimo evento
// `impostazioni` del registro e si cambiano coi comandi `imposta` e `spegni` (contratto v1); `friday avvia` la accende. // nome del protocollo del motore
import { useEffect, useState } from "react";
import type { EsitoComando } from "../../comandi";
import type { ClotchAiApi } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { daPiano } from "../clotch-ai/registro";
import { Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";

declare global {
  interface Window { clotchAi: ClotchAiApi }
}

type Valori = Record<string, unknown>;

/** Ultimo evento `impostazioni` di clotch AI, aggiornato dal vivo; null finché clotch AI non l'ha mai scritto. */
function useImpostazioniClotchAi(): Valori | null {
  const [v, setV] = useState<Valori | null>(null);
  useEffect(() => {
    const prendi = (p: unknown) => setV(daPiano(p).impostazioni);
    window.clotchAi.registro().then(prendi, () => {});
    return window.clotchAi.onRegistro(prendi);
  }, []);
  return v;
}

/** Testi dei frame: «clotch AI non risponde» se non ha preso il comando, se no il perché di clotch AI o «Comando non riuscito». */
export const testoEsito = (e: EsitoComando) =>
  e.esito === "scaduto" && !e.preso ? "clotch AI non risponde" : e.testo || "Comando non riuscito";

export default function ClotchAi() {
  const letti = useImpostazioniClotchAi();
  const [account, setAccount] = useState<string[]>([]);
  // cambi mandati e non ancora tornati nel registro: si vedono subito, se clotch AI rifiuta tornano com'erano
  const [inViaggio, setInViaggio] = useState<Valori>({});
  useEffect(() => {
    window.impostazioni.radici().then((r) => setAccount(r.map((p) => p.split("/").pop()!.replace(/^\.claude-?/, "") || "claude")), () => {});
  }, []);
  // un cambio arrivato nel registro non è più in viaggio
  useEffect(() => setInViaggio((x) => Object.fromEntries(Object.entries(x).filter(([k, val]) => letti?.[k] !== val))), [letti]);

  const v: Valori = { ...letti, ...inViaggio };
  const manda = async (chiave: string, valore: unknown, fai: () => Promise<EsitoComando | { ok: boolean; testo: string }>) => {
    setInViaggio((x) => ({ ...x, [chiave]: valore }));
    const e = await fai().catch((err) => ({ ok: false, testo: String(err?.message ?? err) }));
    const ok = "esito" in e ? e.esito === "ok" : e.ok;
    if (ok) return;
    setInViaggio(({ [chiave]: _, ...resto }) => resto);
    avvisa({ tipo: "errore", messaggio: "esito" in e ? testoEsito(e) : e.testo || "Comando non riuscito" });
  };
  const imposta = (chiave: string, valore: unknown) => manda(chiave, valore, () => window.clotchAi.comando("imposta", { chiave, valore }));
  const attiva = v.attiva === true;
  // senza il suo evento, o spenta, clotch AI non può cambiare le sue impostazioni: i controlli restano spenti
  const spenti = !letti || !attiva;
  const lista = (x: unknown) => (Array.isArray(x) ? x.map(String) : undefined);

  return (
    <Pagina titolo="clotch AI">
      <Gruppo>
        <Riga etichetta="clotch AI attiva" descrizione="Sempre in ascolto, fissa in alto nella barra laterale">
          <Interruttore etichetta="clotch AI attiva" acceso={attiva}
            onCambia={(x) => manda("attiva", x, () => (x ? window.clotchAi.avvia() : window.clotchAi.comando("spegni")))} />
        </Riga>
        <Riga etichetta="Microfono" descrizione="Quello che clotch AI ascolta">
          <Scelta etichetta="Microfono" valore={String(v.microfono ?? "")} voci={lista(v.microfoni_disponibili)}
            onScegli={(x) => imposta("microfono", x)} disabled={spenti} />
        </Riga>
        <Riga etichetta="Voce" descrizione="Come ti risponde">
          <Scelta etichetta="Voce" valore={String(v.voce ?? "")} voci={lista(v.voci_disponibili)}
            onScegli={(x) => imposta("voce", x)} disabled={spenti} />
        </Riga>
        <Riga etichetta="Account" descrizione="Quello che usa per lavorare">
          <Scelta etichetta="Account" valore={String(v.account ?? "")} voci={account.length ? account : undefined}
            onScegli={(x) => imposta("account", x)} disabled={spenti} />
        </Riga>
        <Riga etichetta="Può dare i permessi" descrizione="Consente i comandi alle sessioni quando glielo chiedi">
          <Interruttore etichetta="Può dare i permessi" acceso={v.puo_dare_permessi === true} disabled={spenti}
            onCambia={(x) => imposta("puo_dare_permessi", x)} />
        </Riga>
        <Riga etichetta="Legge le risposte ad alta voce" descrizione="Solo quando le parli">
          <Interruttore etichetta="Legge le risposte ad alta voce" acceso={!!v.legge_ad_alta_voce && v.legge_ad_alta_voce !== "mai"}
            disabled={spenti} onCambia={(x) => imposta("legge_ad_alta_voce", x ? "solo_quando_le_parli" : "mai")} />
        </Riga>
      </Gruppo>
    </Pagina>
  );
}
