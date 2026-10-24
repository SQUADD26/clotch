// Invia gli avvisi di sistema del Mac (#407) a ogni aggiornamento dal vivo: confronta ogni sessione col suo stato di prima.
import { Notification } from "electron";
import { daAvvisare, inSilenzio, type ImpostazioniAvvisi } from "./avvisi";
import { PARTENZA } from "./partenza";
import { quoteUso, sogliePassate } from "./quote-uso";
import type { Aggiornamento, Sessione } from "./tipi";
import { provaSilenziosa } from "./modalita-prova";

/** `elenco`: le sessioni di adesso; `impostazioni`: lette ogni volta dal file (un cambio vale subito; file rotto = {}). Il primo elenco è lo stato di partenza: niente avvisi per ciò che c'era già. */
export function collegaAvvisi(elenco: () => Sessione[], impostazioni: () => ImpostazioniAvvisi, ora = () => new Date()) {
  if (provaSilenziosa()) return (_a: Aggiornamento) => {};
  let viste = new Map(elenco().map((s) => [s.id, s]));
  const soglie = new Map<string, number>();
  // 80% e 90% della quota (CL7): si controllano a ogni aggiornamento dal vivo (il feed ha la sua cache di 60 s); rete giù = niente avviso
  const controllaQuote = () => quoteUso().then((quote) => {
    const imp = impostazioni(), nuove = sogliePassate(quote, soglie); // le soglie si registrano anche in silenzio: non si recuperano dopo
    if (imp.avvisoLimite === false || inSilenzio(imp.silenzio ?? PARTENZA.silenzio, ora()) || !Notification.isSupported()) return;
    for (const n of nuove) new Notification({ title: n.account, body: `Limite di uso: ${n.soglia}%`, silent: true }).show();
  }, () => {});
  return (a: Aggiornamento) => {
    void controllaQuote();
    const adesso = elenco();
    const cambiate = new Set(a.sessioni);
    const imp = impostazioni();
    for (const s of adesso) {
      if (!cambiate.has(s.id)) continue;
      const v = daAvvisare(viste.get(s.id), s, imp, ora());
      if (v && Notification.isSupported()) new Notification({ title: v.titolo, body: v.corpo, silent: v.silenzioso, sound: v.suono }).show();
    }
    viste = new Map(adesso.map((s) => [s.id, s]));
  };
}
