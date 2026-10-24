// Dallo strumento della trascrizione (nome, ingresso, esito) a cosa mostra «Chiamata strumento» (101:7278). Puro.
// Etichette solo dal disegno: Letto, Cercato, Comando, Eseguendo, Comando non riuscito, Modificato, Cercato sul web, Schermata.
import type { NomeIcona } from "../base/icone";

export type StatoStrumento = "chiusa" | "in-corso" | "errore";

export interface Descrizione {
  /** Etichetta in grassetto («tipo» nel frame); per uno strumento che il disegno non nomina, il suo nome. */
  etichetta: string;
  icona: NomeIcona;
  /** Testo in Menlo accanto all'etichetta. */
  dettaglio: string;
  /** Riga «$ comando» del blocco aperto (solo i comandi). */
  comando: string | null;
  /** La chiamata in parole semplici, per la riga del gruppo compatto (#876): «Legge Filo.tsx», «Cerca «x» in 4 file». */
  frase: Frase;
}

const campo = (x: unknown, k: string) => (x && typeof x === "object" && typeof (x as Record<string, unknown>)[k] === "string" ? String((x as Record<string, unknown>)[k]) : "");

/** Il percorso senza la cartella della sessione davanti, come nel disegno («sessioni/package.json»). */
export function relativo(p: string, cartella: string) {
  const c = cartella.replace(/\/+$/, "") + "/";
  return cartella && p.startsWith(c) ? p.slice(c.length) : p;
}

export function descrivi(nome: string, ingresso: unknown, stato: StatoStrumento, cartella = "", uscita = ""): Descrizione {
  return { ...riga(nome, ingresso, stato, cartella), frase: frase(nome, ingresso, uscita) };
}

const base = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

/** Quanti file nomina l'esito di Grep e Glob: «Found 4 files» o una riga per file («a.ts:12:…» o «a.ts»). */
function fileTrovati(uscita: string) {
  const n = uscita.match(/^Found (\d+) files?/);
  if (n) return Number(n[1]);
  const righe = uscita.split("\n").filter((r) => r.trim() && !/^No (files|matches) found/.test(r));
  return new Set(righe.map((r) => r.replace(/:\d+[:-].*$/, ""))).size;
}

export interface Frase { verbo: string; oggetto: string }

/** Nome in grigio e oggetto in chiaro, come «Riga strumento» (163:84207): «Lettura» «Ricerca.tsx». Stile nominale e asciutto, senza verbi (#876). */
export function frase(nome: string, ingresso: unknown, uscita = ""): Frase {
  const file = base(campo(ingresso, "file_path") || campo(ingresso, "path") || campo(ingresso, "notebook_path"));
  const f = (verbo: string, oggetto = "") => ({ verbo, oggetto });
  switch (nome) {
    case "Bash": return f("Comando", campo(ingresso, "description")); // la descrizione la scrive il modello: si cita com'è
    case "Read": return f("Lettura", file);
    case "Grep": case "Glob": {
      const cosa = `"${campo(ingresso, "pattern")}"`, n = uscita ? fileTrovati(uscita) : 0;
      const dove = n ? `, ${n} file` : nome === "Grep" && campo(ingresso, "path") ? `, ${file}` : "";
      return f(nome === "Glob" ? "Ricerca file" : "Ricerca", cosa + dove);
    }
    case "Write": return f("Creazione", file);
    case "Edit": case "MultiEdit": case "NotebookEdit": return f("Modifica", file);
    case "WebSearch": return f("Ricerca web", `"${campo(ingresso, "query")}"`);
    case "WebFetch": { const u = campo(ingresso, "url"); try { return f("Pagina web", new URL(u).hostname.replace(/^www\./, "")); } catch { return f("Pagina web"); } }
    default:
      if (/screenshot/i.test(nome) || campo(ingresso, "action") === "screenshot") return f("Foto", campo(ingresso, "name") || "schermo");
      return f(nome.replace(/^mcp__[^_]+__/, "").replace(/_/g, " "));
  }
}

function riga(nome: string, ingresso: unknown, stato: StatoStrumento, cartella: string): Omit<Descrizione, "frase"> {
  const file = relativo(campo(ingresso, "file_path") || campo(ingresso, "path") || campo(ingresso, "notebook_path"), cartella);
  switch (nome) {
    case "Bash": {
      const cmd = campo(ingresso, "command");
      const etichetta = stato === "errore" ? "Comando non riuscito" : stato === "in-corso" ? "Eseguendo…" : "Comando";
      return { etichetta, icona: "terminale", dettaglio: cmd, comando: `$ ${cmd}` };
    }
    case "Read": return { etichetta: "Letto", icona: "file", dettaglio: file, comando: null };
    case "Grep": case "Glob": {
      const dove = relativo(campo(ingresso, "path"), cartella);
      const cosa = campo(ingresso, "pattern");
      return { etichetta: "Cercato", icona: "cerca", dettaglio: dove ? `${cosa} in ${dove}` : cosa, comando: null };
    }
    case "Edit": case "MultiEdit": case "Write": case "NotebookEdit":
      return { etichetta: "Modificato", icona: "matita", dettaglio: file, comando: null };
    case "WebSearch": case "WebFetch":
      return { etichetta: "Cercato sul web", icona: "globo", dettaglio: campo(ingresso, "query") || campo(ingresso, "url"), comando: null };
    default:
      if (/screenshot/i.test(nome) || campo(ingresso, "action") === "screenshot") return { etichetta: "Schermata", icona: "immagine", dettaglio: campo(ingresso, "name") || campo(ingresso, "filename"), comando: null };
      return { etichetta: nome.replace(/^mcp__[^_]+__/, ""), icona: "terminale", dettaglio: file || primoTesto(ingresso), comando: null };
  }
}

/** Il primo valore di testo dell'ingresso, per gli strumenti che il disegno non nomina. */
function primoTesto(x: unknown) {
  if (!x || typeof x !== "object") return "";
  const v = Object.values(x as Record<string, unknown>).find((y) => typeof y === "string");
  return typeof v === "string" ? v.split("\n")[0] : "";
}

export interface RigaDiff { segno: " " | "-" | "+"; codice: string }

/** Differenze di una modifica dall'ingresso dello strumento: righe tolte (old_string) e aggiunte (new_string). */
export function differenze(nome: string, ingresso: unknown): RigaDiff[] {
  const righe = (s: string) => (s ? s.replace(/\n$/, "").split("\n") : []);
  if (nome === "Write") return righe(campo(ingresso, "content")).map((codice) => ({ segno: "+", codice }));
  const coppie: { vecchio: string; nuovo: string }[] = nome === "MultiEdit" && Array.isArray((ingresso as { edits?: unknown })?.edits)
    ? (ingresso as { edits: unknown[] }).edits.map((e) => ({ vecchio: campo(e, "old_string"), nuovo: campo(e, "new_string") }))
    : [{ vecchio: campo(ingresso, "old_string"), nuovo: campo(ingresso, "new_string") }];
  return coppie.flatMap(({ vecchio, nuovo }) => {
    const v = righe(vecchio), n = righe(nuovo);
    // le righe uguali in testa e in coda restano come contesto, il resto è tolto e aggiunto
    let a = 0; while (a < v.length && a < n.length && v[a] === n[a]) a++;
    let z = 0; while (z < v.length - a && z < n.length - a && v[v.length - 1 - z] === n[n.length - 1 - z]) z++;
    return [
      ...v.slice(0, a).map((codice) => ({ segno: " " as const, codice })),
      ...v.slice(a, v.length - z).map((codice) => ({ segno: "-" as const, codice })),
      ...n.slice(a, n.length - z).map((codice) => ({ segno: "+" as const, codice })),
      ...v.slice(v.length - z).map((codice) => ({ segno: " " as const, codice })),
    ];
  });
}

export interface Fonte { titolo: string; sito: string }

/** Fonti di una ricerca sul web: la riga «Links: [{title, url}]» dell'esito. */
export function fonti(esito: string | undefined): Fonte[] {
  const m = esito?.match(/Links:\s*(\[[\s\S]*?\])\s*(\n|$)/);
  if (!m) return [];
  try {
    return (JSON.parse(m[1]) as { title?: string; url?: string }[]).map((l) => {
      let sito = l.url ?? "";
      try { sito = new URL(sito).hostname.replace(/^www\./, ""); } catch { /* resta l'url */ }
      return { titolo: l.title ?? sito, sito };
    });
  } catch { return []; }
}

export const testoCampo = campo;
