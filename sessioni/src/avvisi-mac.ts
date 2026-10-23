// Invia gli avvisi di sistema del Mac (#407) a ogni aggiornamento dal vivo: confronta ogni sessione col suo stato di prima.
import { Notification } from "electron";
import { daAvvisare, type ImpostazioniAvvisi } from "./avvisi";
import type { Aggiornamento, Sessione } from "./tipi";

/** `elenco`: le sessioni di adesso; `impostazioni`: lette ogni volta dal file (un cambio vale subito; file rotto = {}). Il primo elenco è lo stato di partenza: niente avvisi per ciò che c'era già. */
export function collegaAvvisi(elenco: () => Sessione[], impostazioni: () => ImpostazioniAvvisi, ora = () => new Date()) {
  let viste = new Map(elenco().map((s) => [s.id, s]));
  return (a: Aggiornamento) => {
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
