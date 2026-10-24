// Dal registro di clotch AI ai dati delle schermate clotch AI (#352). Puro: nessun file, nessun DOM.
import type { ChatClotchAi, Registro } from "../../clotch-ai";

/** Contratto: clotch AI manda un battito ogni 60 s; `friday stato` la dà spenta dopo 180 s senza battito. */ // nome del protocollo del motore
const CLOTCH_AI_MUTA_MS = 180_000;
const GENERE: Record<string, string> = { permesso: "Permesso", domanda: "Domanda", piano: "Piano" };

export type StatoClotchAi = "attiva" | "spenta" | "pausa";

export function statoClotchAi(r: Registro, ora: number): { stato: StatoClotchAi; da: number | null } {
  const f = r.chat.get("friday"); // nome del protocollo del motore
  const viva = r.clotchAi?.evento !== "stop" && !!f?.visto && ora - f.visto <= CLOTCH_AI_MUTA_MS;
  if (!viva) return { stato: "spenta", da: f?.visto ?? r.clotchAi?.t ?? null };
  const nd = r.nonDisturbare;
  return nd && (nd.fino === null || nd.fino > ora) ? { stato: "pausa", da: nd.fino } : { stato: "attiva", da: null };
}

const stessoGiorno = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const viva = (c: ChatClotchAi) => !c.fine && c.chat !== "friday" && c.chat !== "terminale"; // nome del protocollo del motore

export interface Attesa { chat: string; titolo: string; genere: string }
export interface Progetto {
  nome: string;
  obiettivo: { testo: string; fatti: number; passi: { testo: string; stato: string }[]; lavora: boolean } | null;
  aspettano: Attesa[];
  alLavoro: number;
  fattoOggi: number;
}

export function casella(r: Registro, ora: number) {
  const gruppi = new Map<string, ChatClotchAi[]>();
  for (const c of r.chat.values()) if (c.progetto && (viva(c) || (c.visto && stessoGiorno(c.visto, ora)))) gruppi.set(c.progetto, [...(gruppi.get(c.progetto) ?? []), c]);
  const progetti: Progetto[] = [...gruppi].map(([nome, cc]) => {
    const vive = cc.filter(viva);
    const madre = vive.find((c) => !c.madre && c.obiettivo && c.obiettivo.stato !== "proposto");
    const aspettano = vive.flatMap((c): Attesa[] => {
      const g = c.richieste[0]?.genere ?? (c.stato === "serve_roberto" ? "domanda" : null);
      return g ? [{ chat: c.chat, titolo: c.titolo ?? c.chat, genere: GENERE[g] ?? g }] : [];
    });
    // stati dei passi: quelli di TodoWrite (pending, in_progress, completed), come li scrive friday_passi.py // nome del protocollo del motore
    return {
      nome,
      obiettivo: madre ? { testo: madre.obiettivo!.testo, fatti: madre.passi.filter((p) => p.stato === "completed").length, passi: madre.passi, lavora: madre.stato === "lavora" } : null,
      aspettano,
      alLavoro: vive.filter((c) => c.stato === "lavora").length,
      fattoOggi: cc.filter((c) => c.stato === "finito" && c.visto !== null && stessoGiorno(c.visto, ora)).length,
    };
  });
  progetti.sort((a, b) => b.aspettano.length - a.aspettano.length || a.nome.localeCompare(b.nome));
  const proposti = [...r.chat.values()].filter((c) => viva(c) && c.obiettivo?.stato === "proposto")
    .map((c) => ({ chat: c.chat, progetto: c.progetto ?? "", testo: c.obiettivo!.testo }));
  return {
    progetti, proposti,
    aspettano: progetti.reduce((n, p) => n + p.aspettano.length, 0),
    alLavoro: progetti.reduce((n, p) => n + p.alLavoro, 0),
  };
}

/** Decisioni dalla più nuova, a gruppi per giorno («Oggi», «Ieri» o la data). */
export function decisioniPerGiorno(r: Registro, ora: number) {
  const ieri = ora - 86_400_000;
  const giorno = (t: number | null) => t === null ? "" : stessoGiorno(t, ora) ? "Oggi" : stessoGiorno(t, ieri) ? "Ieri"
    : new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const annullate = new Set(r.decisioni.filter((d) => d.cosa.startsWith("annullata ")).map((d) => d.cosa.slice(10)));
  const gruppi = new Map<string, Registro["decisioni"]>();
  for (const d of [...r.decisioni].reverse()) {
    if (d.cosa.startsWith("annullata ")) continue; // la riga che il motore scrive quando annulla (friday_comandi.py) // nome del protocollo del motore
    const g = giorno(d.t);
    const annullata = d.annullata || annullate.has(d.id);
    gruppi.set(g, [...(gruppi.get(g) ?? []), { ...d, annullata, annullabile: d.annullabile && !annullata }]);
  }
  return [...gruppi].map(([titolo, voci]) => ({ titolo, voci }));
}

/** Regole a gruppi per `dove` (repo o cartella), in ordine di arrivo. */
export function regolePerDove(r: Registro) {
  const gruppi = new Map<string, Registro["regole"]>();
  // dalla più nuova (101-40473); senza data in fondo
  const nuove = [...r.regole].sort((a, b) => (b.t ?? 0) - (a.t ?? 0));
  for (const x of nuove) gruppi.set(x.dove, [...(gruppi.get(x.dove) ?? []), x]);
  return [...gruppi].map(([dove, regole]) => ({ dove, regole }));
}

export const sessioniAlLavoro = (r: Registro) => [...r.chat.values()].filter((c) => viva(c) && c.stato === "lavora" && !c.fermata).length;

/** «Cosa aspetta me?» c'è sempre; le altre due solo se il registro conosce dei progetti. */
export function suggerimenti(r: Registro, ora: number): string[] {
  const { progetti } = casella(r, ora);
  const lavora = progetti.filter((p) => p.alLavoro > 0).sort((a, b) => b.alLavoro - a.alLavoro)[0] ?? progetti[0];
  const altro = progetti.find((p) => p !== lavora);
  return ["Cosa aspetta me?", ...(lavora ? [`Ferma le sessioni di ${lavora.nome}`] : []), ...(altro ? [`Com’è messo ${altro.nome}?`] : [])];
}
