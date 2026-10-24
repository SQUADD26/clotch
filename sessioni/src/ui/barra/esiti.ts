// Ogni voce di menu che lavora lontano dalla riga dice com'è andata (#719): avviso di successo, di errore o con «Annulla».
import type { AzioneSessione } from "../../tipi";
import { api, messaggioErrore } from "../base/dati";
import { avvisa } from "../base/Avvisi";

/** Azione del main (copia, Finder, finestra): `ok` è l'avviso di successo, assente se l'effetto si vede già; l'errore si dice sempre. */
export const azione = (id: string, a: AzioneSessione, ok?: string) => () => {
  api().azione(id, a).then(() => { if (ok) avvisa({ tipo: "successo", messaggio: ok }); }, (e) => avvisa({ tipo: "errore", messaggio: messaggioErrore(e) }));
};

const comando = (cmd: "archivia" | "ripristina", id: string) => window.clotchAi.comando(cmd, { chat: id });
const riuscito = (e: Awaited<ReturnType<typeof comando>> | null) => e?.esito === "ok";

/** Archivia una o più sessioni con un solo avviso: «Annulla» le riporta com'erano; se clotch AI non risponde, lo dice. */
export async function archivia(ids: string[]) {
  const esiti = await Promise.all(ids.map((id) => comando("archivia", id).catch(() => null)));
  const fatte = ids.filter((_, i) => riuscito(esiti[i]));
  if (!fatte.length) {
    const e = esiti.find((x) => x);
    return avvisa({ tipo: "errore", messaggio: e && "testo" in e && e.testo ? e.testo : "Archiviazione non riuscita: clotch AI non risponde" });
  }
  avvisa({
    tipo: "info", messaggio: fatte.length === 1 ? "Sessione archiviata" : `${fatte.length} sessioni archiviate`,
    azione: { etichetta: "Annulla", fai: () => { void Promise.all(fatte.map((id) => comando("ripristina", id).catch(() => null))); } },
  });
}
