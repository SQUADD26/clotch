// Trascrizione Claude Code (righe JSONL) -> messaggi. Formato verificato su ~/.claude/projects.
import { Messaggio, RifImmagine } from "./tipi";
import { senzaSistema } from "./messaggi-sistema";

type Strumento = Extract<Messaggio, { tipo: "strumento" }>;

const tempo = (o: any): number | null => {
  const t = typeof o?.timestamp === "string" ? Date.parse(o.timestamp) : NaN;
  return Number.isNaN(t) ? null : t;
};

// Chi ha scritto il turno: solo human e sdk (anche i prompt di dispatch) sono testo da mostrare come utente; task_notification e peer
// diventano righe evento (modello.ts); ogni altro valore (system, scheduled, auto_continuation, plugin, coordinator…) l'ha scritto l'harness (#484).
const DIGITATI = new Set(["human", "sdk", "task_notification", "task-notification", "peer"]);
const nonDigitato = (o: any) => (o.turnOrigin !== undefined && !DIGITATI.has(o.turnOrigin)) || (o.origin?.kind !== undefined && !DIGITATI.has(o.origin.kind));

const stringa = (x: unknown) => (typeof x === "string" ? x : "");

const testoDi = (c: unknown): string => {
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.map((b: any) => (b?.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
};

export interface ImmagineRiga { n: number; mime: string; byte: number; data: string; tool: string | null }

/** Le immagini base64 di una riga, in ordine di lettura; `tool` = id dello strumento di cui sono l'esito. Le legge anche `allegati.ts`: stessa regola per `n`. */
export function immaginiDiRiga(c: unknown): ImmagineRiga[] {
  const out: ImmagineRiga[] = [];
  const giu = (x: unknown, tool: string | null) => {
    if (!Array.isArray(x)) return;
    for (const b of x) {
      if (b?.type === "image" && b.source?.type === "base64" && typeof b.source.data === "string")
        out.push({ n: out.length, mime: stringa(b.source.media_type) || "image/png", byte: Math.floor((b.source.data.length * 3) / 4) - (b.source.data.match(/=*$/)![0].length), data: b.source.data, tool });
      else if (b?.type === "tool_result") giu(b.content, stringa(b.tool_use_id));
    }
  };
  giu(c, null);
  return out;
}

/** Tiene in memoria solo le chiamate senza esito, per agganciare il tool_result che arriva dopo. */
export class Convertitore {
  private attesa = new Map<string, Strumento>();

  /** `nuovi`: messaggi nati da questa riga. `aggiornati`: chiamate che ora hanno l'esito. */
  riga(o: any): { nuovi: Messaggio[]; aggiornati: Strumento[] } {
    const nuovi: Messaggio[] = [];
    const aggiornati: Strumento[] = [];
    if (!o || typeof o !== "object" || o.isMeta) return { nuovi, aggiornati };
    const t = tempo(o);

    if (o.type === "system" && o.level === "error") {
      nuovi.push({ tipo: "errore", testo: String(o.content ?? ""), t });
    } else if (o.type === "user" || o.type === "assistant") {
      const c = o.message?.content;
      const fuori = o.type === "user" && nonDigitato(o);
      if (o.type === "assistant" && o.isApiErrorMessage) {
        nuovi.push({ tipo: "errore", testo: testoDi(c), t });
      } else if (typeof c === "string") {
        const testo = o.type === "user" ? (fuori ? "" : senzaSistema(c)) : c; // i testi dell'harness non sono di Roberto (#484)
        if (testo.trim()) nuovi.push(o.type === "user" ? { tipo: "utente", testo, t } : { tipo: "assistente", testo, modello: o.message?.model ?? null, t });
      } else if (Array.isArray(c)) {
        // le immagini incollate stanno sul primo testo della riga; quelle di un esito sullo strumento
        const rif = (i: { n: number; mime: string; byte: number }, nome?: string): RifImmagine => ({ riga: o.uuid, n: i.n, mime: i.mime, byte: i.byte, ...(nome ? { nome } : {}) });
        const imgs = typeof o.uuid === "string" && o.type === "user" && !fuori ? immaginiDiRiga(c) : [];
        const mie = imgs.filter((i) => i.tool === null).map((i, k) => rif(i, `Immagine ${o.imagePasteIds?.[k] ?? k + 1}`));
        const testoBlocco = (b: any): string => (b?.type === "text" && typeof b.text === "string" ? (o.type === "user" ? (fuori ? "" : senzaSistema(b.text)) : b.text) : "");
        if (mie.length && !c.some((b: any) => testoBlocco(b).trim())) nuovi.push({ tipo: "utente", testo: "", t, immagini: mie });
        for (const b of c) {
          const testo = testoBlocco(b);
          if (testo.trim()) {
            nuovi.push(o.type === "user" ? { tipo: "utente", testo, t, ...(mie.length ? { immagini: mie.splice(0) } : {}) } : { tipo: "assistente", testo, modello: o.message?.model ?? null, t });
          } else if (b?.type === "thinking" && typeof b.thinking === "string" && b.thinking.trim()) {
            nuovi.push({ tipo: "pensiero", testo: b.thinking, t });
          } else if (b?.type === "tool_use") {
            const m: Strumento = { tipo: "strumento", id: stringa(b.id), nome: stringa(b.name) || "strumento", ingresso: b.input, esito: null, t };
            if (m.id) this.attesa.set(m.id, m); // senza id nessun esito può agganciarsi
            nuovi.push(m);
          } else if (b?.type === "tool_result") {
            const m = this.attesa.get(stringa(b.tool_use_id));
            if (m) {
              const sue = imgs.filter((i) => i.tool === stringa(b.tool_use_id)).map((i) => rif(i));
              m.esito = { testo: testoDi(b.content), errore: b.is_error === true, ...(sue.length ? { immagini: sue } : {}) };
              this.attesa.delete(m.id);
              aggiornati.push(m);
            }
          }
        }
      }
    }
    return { nuovi, aggiornati };
  }
}
