// Comandi `regola` di clotch AI (contratto v1): aggiunta, modifica (aggiunta + `togli` della vecchia) e rimozione, con l'avviso dell'esito.
import type { Registro } from "../../clotch-ai";
import { aggiornaAvviso, avvisa } from "../base/Avvisi";
import { clotchAi } from "./dati";
import { mentreInCorso } from "./inCorso";

export type Regola = Registro["regole"][number];
type Esito = { esito: string; testo: string; pr?: number };

// dove vivono le regole (contratto v1, comando `regola`): generali in claude-config, di progetto nel repo
export const GENERALI = "claude-config";
export const repo = (dove: string) => (dove === GENERALI ? GENERALI : dove.split("/").filter(Boolean).pop() ?? dove);
/** Il nome che Roberto riconosce (101-40473), non quello interno del motore: il comando porta solo `dove`. */
export const file = (dove: string) => (dove === GENERALI ? "global/CLAUDE.md" : "CLAUDE.md");
export const chiave = (x: Regola) => `${x.dove}\n${x.testo}`;

export const avvisoSalvataggio = (dove: string) => avvisa({ tipo: "caricamento", messaggio: `Aprendo la PR in ${repo(dove)}…` });

/** Esito del comando: `pr` della PR aperta da clotch AI, o il perché del no (`riprova` rifà il comando). */
export function esitoSalvataggio(id: number, e: Esito, riprova: () => void, fatto = "salvata") {
  if (e.esito === "ok") {
    // shortcut: «Apri» della PR manca finché il registro non dà l'indirizzo della PR (solo il numero, `pr`)
    aggiornaAvviso(id, { tipo: "successo", messaggio: e.pr ? `Regola ${fatto}. PR #${e.pr} aperta.` : `Regola ${fatto}.` });
  } else {
    aggiornaAvviso(id, { tipo: "errore", messaggio: e.testo || `Regola non ${fatto}: la PR non si apre.`, azione: { etichetta: "Riprova", fai: riprova } });
  }
}

const comando = (a: Record<string, unknown>): Promise<Esito> => clotchAi().comando("regola", a).catch(() => ({ esito: "errore", testo: "" }));

/** `nuova`: esito dell'aggiunta già riuscita (modifica). Se togliere la vecchia fallisce, la nuova c'è già: «Riprova» rifà solo il `togli` (#1047). */
async function passoTogli(vecchia: Regola, id: number, nuova?: Esito) {
  const e = await comando({ testo: vecchia.testo, dove: vecchia.dove, togli: true });
  const riprova = () => togli(vecchia, nuova);
  if (e.esito === "ok" || !nuova) return esitoSalvataggio(id, e.esito === "ok" && nuova ? nuova : e, riprova, nuova ? "salvata" : "rimossa");
  aggiornaAvviso(id, { tipo: "errore", messaggio: `Regola nuova salvata${nuova.pr ? `, PR #${nuova.pr}` : ""}. La vecchia resta.`, azione: { etichetta: "Riprova", fai: riprova } });
}

export const togli = (vecchia: Regola, nuova?: Esito) => {
  const id = avvisoSalvataggio(vecchia.dove);
  return mentreInCorso(chiave(vecchia), () => passoTogli(vecchia, id, nuova));
};

export async function salva(vecchia: Regola, testo: string) {
  const id = avvisoSalvataggio(vecchia.dove);
  await mentreInCorso(chiave(vecchia), async () => {
    const e = await comando({ testo, perche: vecchia.perche, dove: vecchia.dove, togli: false });
    if (e.esito !== "ok") return esitoSalvataggio(id, e, () => salva(vecchia, testo));
    await passoTogli(vecchia, id, e);
  });
}
