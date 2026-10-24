// Allegati e immagini della chat (#437), parte pura: peso, percorsi in fondo al messaggio, chiavi della galleria.
// figma: 101-28041 — dati dei «chip allegato» (nome, peso) e delle «miniatura»; il motore scrive i file nel messaggio come `@percorso`, una riga per file.
import type { CasellaApi, DaImmagine, RifImmagine } from "../../tipi";
import type { Voce } from "./modello";
import { eImmagine, limiteAllegato } from "../../allegati-limiti";

declare global {
  interface Window { casella: CasellaApi }
}
export const casella = (): CasellaApi => window.casella;

/** «312 KB», «4 KB», «1,2 MB», «120 B»: i Finder del Mac contano a mille. */
export function peso(byte: number | null): string {
  if (byte == null) return "";
  if (byte < 1000) return `${byte} B`;
  if (byte < 1_000_000) return `${Math.round(byte / 1000)} KB`;
  return `${(byte / 1_000_000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
}

/** Come sta un allegato nella casella: `carico` finché se ne legge il peso, `grande` se supera il limite del suo tipo (148:49251); `null` = pronto a partire. */
export const statoAllegato = (a: { nome: string; byte: number | null; carico?: boolean }): "carico" | "grande" | null =>
  a.carico ? "carico" : a.byte != null && a.byte > limiteAllegato(a.nome) ? "grande" : null;

export { eImmagine };
export const nomeFile = (percorso: string) => percorso.replace(/\/+$/, "").split("/").pop() ?? percorso;

const RIGA_PERCORSO = /^@(?:"(\/[^"\n]+)"|(\/\S+))$/;

/** Il contrario: le righe `@/percorso` in fondo al messaggio diventano allegati, il resto è il testo. */
export function senzaPercorsi(testo: string): { testo: string; percorsi: string[] } {
  const righe = testo.split("\n"), percorsi: string[] = [];
  while (righe.length > 1) {
    const m = righe[righe.length - 1].trim().match(RIGA_PERCORSO);
    if (!m) break;
    percorsi.unshift(m[1] ?? m[2]);
    righe.pop();
  }
  return { testo: righe.join("\n").trimEnd(), percorsi };
}

/** Il segnaposto «[Image #1]» che Claude Code scrive nel testo: le immagini si vedono come allegati, il segnaposto no. */
export const senzaSegnaposto = (testo: string) => testo.replace(/\[Image #\d+\]\s*/g, "").trim();

export const chiaveImmagine = (da: DaImmagine) => ("percorso" in da ? da.percorso : `${da.rif.riga}:${da.rif.n}`);

export interface VoceGalleria { chiave: string; nome: string; da: DaImmagine }

/** Le immagini del filo, dalla più recente: quelle incollate e allegate da Roberto, quelle degli esiti degli strumenti. */
export function galleria(voci: Voce[], sessione: string): VoceGalleria[] {
  const rif = (r: RifImmagine, nome: string): VoceGalleria => { const da = { sessione, rif: r }; return { chiave: chiaveImmagine(da), nome, da }; };
  const out = voci.flatMap((v): VoceGalleria[] => {
    if (v.tipo === "roberto")
      return [...(v.immagini ?? []).map((r) => rif(r, r.nome ?? "Immagine")),
        ...(v.percorsi ?? []).filter(eImmagine).map((percorso) => ({ chiave: percorso, nome: nomeFile(percorso), da: { percorso } }))];
    if (v.tipo !== "turno") return [];
    return v.blocchi.flatMap((b) => (b.tipo === "strumento" ? (b.immagini ?? []).map((r) => rif(r, nomeFile(b.dettaglio) || b.etichetta)) : []));
  });
  return out.reverse();
}
