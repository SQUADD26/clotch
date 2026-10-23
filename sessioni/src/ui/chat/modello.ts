// Dai messaggi della trascrizione alle voci del filo (frame 101:8036 e «Chat al lavoro»). Puro: niente DOM, niente IPC.
// Un messaggio di Roberto apre un turno; nel turno i blocchi stanno nell'ordine in cui arrivano.
// Un turno finito mostra le modifiche riunite in «File toccati» (101:8036, 101:15335); quello vivo le mostra una a una (101:14631).
import type { Messaggio } from "../../tipi";
import { ramoCreato } from "./eventi";
import { descrivi, differenze, fonti, testoCampo, type Descrizione, type Fonte, type RigaDiff, type StatoStrumento } from "./strumenti";

type Strumento = Extract<Messaggio, { tipo: "strumento" }>;

export interface FileToccato { file: string; aggiunte: number; tolte: number }
export interface Aiutante { id: string; nome: string; azione: string; durata: number | null; finito: boolean }
export interface Passo { testo: string; stato: "fatto" | "in-corso" | "da-fare" }

export type Blocco = (
  | { tipo: "pensiero"; testo: string; durata: number | null; inCorso: boolean }
  | ({ tipo: "strumento"; id: string; stato: StatoStrumento; durata: number | null; uscita: string } & Descrizione)
  | { tipo: "modifica"; id: string; file: string; aggiunte: number; tolte: number; righe: RigaDiff[]; durata: number | null }
  | { tipo: "web"; id: string; query: string; fonti: Fonte[] }
  | { tipo: "attivita"; passi: Passo[] }
  | { tipo: "aiutanti"; aiutanti: Aiutante[] }
  | { tipo: "domanda"; id: string; domande: { domanda: string; opzioni: string[] }[]; risposta: string | null; aperta: boolean }
  | { tipo: "piano"; id: string; testo: string; approvato: boolean; aperto: boolean }
  | { tipo: "bloccato"; id: string; testo: string }
  | { tipo: "file-toccati"; file: FileToccato[] }
  | { tipo: "risposta"; testo: string; inScrittura: boolean }
  | { tipo: "interrotta" }
  | { tipo: "errore"; testo: string }) & { chiave?: string; origini?: string[] };

export type Voce =
  | { tipo: "roberto"; chiave: string; testo: string; t: number | null }
  | { tipo: "riassunto"; chiave: string }
  /** Cosa è successo nella sessione (101:28725): `testo` è già la riga da scrivere. */
  | { tipo: "evento"; chiave: string; testo: string; t: number | null }
  | { tipo: "turno"; chiave: string; blocchi: Blocco[]; origini?: string[]; inizio: number | null; fine: number | null };

const MODIFICHE = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);
const INTERRUZIONE = /^\[Request interrupted by user/;
const RIASSUNTO = /^This session is being continued from a previous conversation/;
// esiti che dicono «bloccato da una regola o da un hook» (situazioni 11, 11b del catalogo)
const BLOCCO = /^(<tool_use_error>)?(PreToolUse|Permission to use|.*denied by .*(rule|hook))/;
const RIFIUTO = /^The user doesn't want to proceed/;

/** Stato di uno strumento: ancora senza esito = in corso finché la sessione lavora, poi chiuso. */
function stato(m: Strumento, vivo: boolean): StatoStrumento {
  if (!m.esito) return vivo ? "in-corso" : "chiusa";
  return m.esito.errore ? "errore" : "chiusa";
}

/** Le opzioni del disegno sono testi; «(Recommended)» resta nel testo e il filo lo mostra come «Consigliata». */
const domandeDi = (ingresso: unknown) => {
  const q = (ingresso as { questions?: unknown[] })?.questions;
  return Array.isArray(q) ? q.map((d) => ({
    domanda: testoCampo(d, "question"),
    opzioni: Array.isArray((d as { options?: unknown[] }).options) ? (d as { options: unknown[] }).options.map((o) => testoCampo(o, "label")) : [],
  })) : [];
};

/** «User has answered your questions: "D"="R"» -> «R» (una o più risposte, separate da « · »). */
const rispostaDi = (esito: string) => [...esito.matchAll(/"[^"]*"="([^"]*)"/g)].map((m) => m[1]).join(" · ") || null;

const passiDi = (ingresso: unknown): Passo[] => {
  const t = (ingresso as { todos?: unknown[] })?.todos;
  return Array.isArray(t) ? t.map((x) => {
    const s = testoCampo(x, "status");
    return { testo: testoCampo(x, "content") || testoCampo(x, "activeForm"), stato: s === "completed" ? "fatto" : s === "in_progress" ? "in-corso" : "da-fare" };
  }) : [];
};

export function contaRighe(righe: RigaDiff[]) {
  return { aggiunte: righe.filter((r) => r.segno === "+").length, tolte: righe.filter((r) => r.segno === "-").length };
}

/**
 * `vivo`: la sessione lavora ancora (situazione «lavora», «aiutanti»…): l'ultimo turno è aperto, gli strumenti senza esito girano.
 * `cartella`: per mostrare i percorsi relativi.
 */
export function voci(messaggi: Messaggio[], vivo: boolean, cartella = "", identita?: readonly { chiave: string }[], precedenti: readonly Voce[] = [], sessione = ""): Voce[] {
  const out: Voce[] = [];
  let turno: Extract<Voce, { tipo: "turno" }> | null = null;
  let inizio: number | null = null; // il turno dura dal messaggio di Roberto che lo apre
  const tempoDopo = (i: number) => { for (let j = i + 1; j < messaggi.length; j++) if (messaggi[j].t != null) return messaggi[j].t; return null; };
  const durata = (i: number) => { const a = messaggi[i].t, b = tempoDopo(i); return a != null && b != null && b >= a ? b - a : null; };

  messaggi.forEach((m, i) => {
    const fisica = identita?.[i]?.chiave;
    const chiave = fisica ? `fisico:${JSON.stringify([sessione, fisica])}` : `${i}-${m.t ?? ""}`;
    const prima = new Set(turno?.blocchi);
    elabora(m, i, chiave);
    if (!fisica || !turno) return;
    turno.origini = [...(turno.origini ?? []), chiave];
    for (const b of turno.blocchi) {
      const aggregato = m.tipo === "strumento" && ((m.nome === "TodoWrite" && b.tipo === "attivita") ||
        (["Agent", "Task"].includes(m.nome) && b.tipo === "aiutanti"));
      if (!prima.has(b) || aggregato) {
        b.chiave ??= `${chiave}:${b.tipo}`;
        b.origini = [...(b.origini ?? []), chiave];
      }
    }
  });

  function elabora(m: Messaggio, i: number, chiave: string) {
    if (m.tipo === "utente") {
      if (INTERRUZIONE.test(m.testo)) { (turno ?? apri(m.t, chiave)).blocchi.push({ tipo: "interrotta" }); return; }
      if (RIASSUNTO.test(m.testo)) { turno = null; out.push({ tipo: "riassunto", chiave }); return; }
      turno = null;
      inizio = m.t;
      out.push({ tipo: "roberto", chiave, testo: m.testo, t: m.t });
      return;
    }
    // un ramo creato finisce il turno: la riga dell'evento sostituisce il comando e il filo riparte da lei
    const ramo = m.tipo === "strumento" && m.esito && !m.esito.errore && m.nome === "Bash" ? ramoCreato(testoCampo(m.ingresso, "command")) : null;
    if (ramo) { turno = null; out.push({ tipo: "evento", chiave, testo: `Ramo creato: ${ramo}`, t: m.t }); return; }
    const tu = turno ?? apri(m.t, chiave);
    if (m.t != null) tu.fine = m.t;
    const ultimo = i === messaggi.length - 1;
    switch (m.tipo) {
      case "pensiero": tu.blocchi.push({ tipo: "pensiero", testo: m.testo, durata: durata(i), inCorso: vivo && ultimo }); return;
      case "assistente": tu.blocchi.push({ tipo: "risposta", testo: m.testo, inScrittura: vivo && ultimo }); return;
      case "errore": tu.blocchi.push({ tipo: "errore", testo: m.testo }); return;
      case "strumento": return strumento(tu, m, i);
    }
  }

  function apri(t: number | null, chiave: string) {
    turno = { tipo: "turno", chiave: identita ? `turno:${chiave}` : chiave, blocchi: [], inizio: inizio ?? t, fine: t };
    out.push(turno);
    return turno;
  }

  function strumento(tu: Extract<Voce, { tipo: "turno" }>, m: Strumento, i: number) {
    const st = stato(m, vivo), esito = m.esito?.testo ?? "";
    if (m.esito?.errore && RIFIUTO.test(esito)) return; // «Negato da te»: lo dice la riga «Interrotta da te» che segue
    if (m.nome === "TodoWrite") {
      const b = tu.blocchi.find((x) => x.tipo === "attivita");
      if (b && b.tipo === "attivita") b.passi = passiDi(m.ingresso); else tu.blocchi.push({ tipo: "attivita", passi: passiDi(m.ingresso) });
      return;
    }
    if (m.nome === "Agent" || m.nome === "Task") {
      const a: Aiutante = {
        id: identita?.[i]?.chiave ? `aiutante:${JSON.stringify([sessione, identita[i].chiave])}` : m.id, nome: testoCampo(m.ingresso, "description") || testoCampo(m.ingresso, "subagent_type"),
        azione: esito.split("\n")[0], durata: durata(i), finito: !!m.esito && !/^Async agent launched/.test(esito),
      };
      const b = tu.blocchi.find((x) => x.tipo === "aiutanti");
      if (b && b.tipo === "aiutanti") b.aiutanti.push(a); else tu.blocchi.push({ tipo: "aiutanti", aiutanti: [a] });
      return;
    }
    if (m.nome === "AskUserQuestion") {
      tu.blocchi.push({ tipo: "domanda", id: m.id, domande: domandeDi(m.ingresso), risposta: m.esito ? rispostaDi(esito) : null, aperta: !m.esito });
      return;
    }
    if (m.nome === "ExitPlanMode") {
      tu.blocchi.push({ tipo: "piano", id: m.id, testo: testoCampo(m.ingresso, "plan"), approvato: !!m.esito && !m.esito.errore, aperto: !m.esito });
      return;
    }
    if (m.nome === "WebSearch" || m.nome === "WebFetch") {
      tu.blocchi.push({ tipo: "web", id: m.id, query: testoCampo(m.ingresso, "query") || testoCampo(m.ingresso, "url"), fonti: fonti(m.esito?.testo) });
      return;
    }
    if (MODIFICHE.has(m.nome) && st !== "errore") {
      const righe = differenze(m.nome, m.ingresso);
      const file = descrivi(m.nome, m.ingresso, st, cartella).dettaglio;
      tu.blocchi.push({ tipo: "modifica", id: m.id, file, righe, ...contaRighe(righe), durata: durata(i) });
      return;
    }
    // bloccato da una regola: la chiamata resta una riga normale, il perché va nell'avviso senza il nome dell'hook (101:15790)
    const bloccato = !!m.esito?.errore && BLOCCO.test(esito);
    const stRiga = bloccato ? "chiusa" : st;
    tu.blocchi.push({ tipo: "strumento", id: m.id, stato: stRiga, durata: durata(i), uscita: esito, ...descrivi(m.nome, m.ingresso, stRiga, cartella) });
    if (bloccato) tu.blocchi.push({ tipo: "bloccato", id: m.id, testo: esito.replace(/<\/?tool_use_error>/g, "").replace(/^PreToolUse:\S*\s*(hook error:\s*)?(\[[^\]]*\]:\s*)?/, "") });
  }

  // turni finiti: le modifiche diventano un solo «File toccati» prima dell'ultima risposta
  out.forEach((v, k) => {
    if (v.tipo !== "turno" || (vivo && k === out.length - 1)) return;
    const mod = v.blocchi.filter((b): b is Extract<Blocco, { tipo: "modifica" }> => b.tipo === "modifica");
    if (!mod.length) return;
    const perFile = new Map<string, FileToccato>();
    for (const b of mod) {
      const f = perFile.get(b.file) ?? { file: b.file, aggiunte: 0, tolte: 0 };
      f.aggiunte += b.aggiunte; f.tolte += b.tolte; perFile.set(b.file, f);
    }
    const resto = v.blocchi.filter((b) => b.tipo !== "modifica");
    const r = resto.map((b) => b.tipo).lastIndexOf("risposta");
    const origini = mod.flatMap((b) => b.origini ?? []);
    resto.splice(r < 0 ? resto.length : r, 0, { tipo: "file-toccati", file: [...perFile.values()],
      ...(origini.length ? { chiave: `${origini[0]}:file-toccati`, origini } : {}) });
    v.blocchi = resto;
  });
  if (identita) {
    const turni = out.filter((v): v is Extract<Voce, { tipo: "turno" }> => v.tipo === "turno");
    const vecchi = precedenti.filter((v): v is Extract<Voce, { tipo: "turno" }> => v.tipo === "turno");
    riconcilia(turni, vecchi);
    for (const t of turni) riconcilia(t.blocchi, vecchi.find((v) => v.chiave === t.chiave)?.blocchi ?? []);
  }
  return out;
}

/** «Finita in 4 min 12 s» e «18 strumenti · 3 file · 2 aiutanti» dell'ultimo turno (101:15335). */
export function riepilogo(v: Extract<Voce, { tipo: "turno" }>) {
  let strumenti = 0, aiutanti = 0;
  const file = new Set<string>();
  for (const b of v.blocchi) {
    if (b.tipo === "strumento" || b.tipo === "web") strumenti++;
    if (b.tipo === "modifica") { strumenti++; file.add(b.file); }
    if (b.tipo === "file-toccati") for (const f of b.file) { strumenti++; file.add(f.file); }
    if (b.tipo === "aiutanti") aiutanti += b.aiutanti.length;
  }
  return { durata: v.inizio != null && v.fine != null ? v.fine - v.inizio : null, strumenti, file: file.size, aiutanti };
}


/** Un gruppo mantiene la propria identità se contiene nascite fisiche già montate.
 * Matching uno-a-uno per sovrapposizione: merge/split non duplica chiavi o trasferisce stato fra gruppi. */
function riconcilia(nuovi: { tipo: string; chiave?: string; origini?: string[] }[], vecchi: readonly { tipo: string; chiave?: string; origini?: string[] }[]) {
  const indice = new Map<string, number[]>();
  vecchi.forEach((g, i) => {
    for (const o of g.origini ?? []) {
      const k = `${g.tipo}:${o}`;
      indice.set(k, [...(indice.get(k) ?? []), i]);
    }
  });
  const candidati: { nuovo: number; vecchio: number; peso: number }[] = [];
  nuovi.forEach((g, nuovo) => {
    const pesi = new Map<number, number>();
    for (const o of g.origini ?? []) for (const i of indice.get(`${g.tipo}:${o}`) ?? []) pesi.set(i, (pesi.get(i) ?? 0) + 1);
    for (const [vecchio, peso] of pesi) candidati.push({ nuovo, vecchio, peso });
  });
  candidati.sort((a, b) => b.peso - a.peso || a.vecchio - b.vecchio || a.nuovo - b.nuovo);
  const presi = new Set<number>(), usati = new Set<number>();
  for (const c of candidati) {
    if (presi.has(c.nuovo) || usati.has(c.vecchio)) continue;
    nuovi[c.nuovo].chiave = vecchi[c.vecchio].chiave;
    presi.add(c.nuovo); usati.add(c.vecchio);
  }
}
