// Testi che l'harness di Claude Code scrive come messaggi `user` ma che Roberto non ha scritto (#484).
// Nessun campo della riga li separa dai prompt veri (provato su ~/.claude/projects: origin assente nelle trascrizioni vecchie e
// «human» anche su system-reminder; turnOrigin/promptSource «sdk» anche sui prompt di dispatch; permissionMode presente su tutti),
// quindi la regola è strutturale: un blocco chiuso `<nome-con-trattini>…</nome-con-trattini>` in testa o in coda al testo è dell'harness,
// qualunque sia il nome (anche mai visto). Un nome di una parola sola (`<wake reason=…>`, `<relay from=…>`) conta solo se ha attributi, così `<div>` resta di Roberto.
// Restano di Roberto `<pasted_content>` e `<bash-input>`; task-notification e i messaggi tra sessioni li legge `notifiche`, come righe evento.
const NOME = "[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*";
const LASCIATI = new Set(["pasted_content", "bash-input", "task-notification", "cross-session-message", "relay"]);
const IN_TESTA = new RegExp(`^\\s*<(${NOME})(?:\\s[^>]*)?>[\\s\\S]*?</\\1>\\s*`);
const IN_CODA = new RegExp(`\\s*<(${NOME})(?:\\s[^>]*)?>[\\s\\S]*?</\\1>\\s*$`);
const RE_EVENTO = /<task-notification>([\s\S]*?)(?:<\/task-notification>|$)|(?:Another Claude session sent a message:\s*)?<(cross-session-message|relay)\b([^>]*)>[\s\S]*?(?:<\/\2>|$)/g;

const dellHarness = (m: RegExpExecArray) => !LASCIATI.has(m[1]) && (/[-_]/.test(m[1]) || /^\s*<\S+\s/.test(m[0].trimStart()));

/** Toglie i blocchi che l'harness mette in testa o in coda ai messaggi dell'utente; se non ne trova ridà il testo identico. */
export function senzaSistema(testo: string): string {
  let r = testo;
  for (;;) {
    const a = IN_TESTA.exec(r);
    if (a && dellHarness(a)) { r = r.slice(a[0].length); continue; }
    const b = r.trimEnd().endsWith(">") ? IN_CODA.exec(r) : null;
    if (b && dellHarness(b)) { r = r.slice(0, b.index); continue; }
    break;
  }
  return r === testo ? testo : r.trim();
}

/** Riga breve per una notifica di fine attività: «Comando in background finito», «Agente "x" non riuscito». */
function rigaNotifica(corpo: string): string {
  const campo = (n: string) => corpo.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1].trim() ?? "";
  const stato = campo("status"), sommario = campo("summary");
  const [, tipo, desc] = sommario.match(/^(Agent|Monitor|Dynamic workflow) "([\s\S]*)" \S/) ?? [];
  const chi = tipo === "Agent" ? "Agente" : tipo === "Dynamic workflow" ? "Workflow" : tipo === "Monitor" ? "Monitor" : "Comando in background";
  const nome = desc ? `${chi} "${desc.length > 60 ? `${desc.slice(0, 59)}…` : desc}"` : chi;
  const esito = /waiting/.test(sommario) ? "in attesa" : stato === "failed" ? "non riuscito" : stato === "killed" || stato === "stopped" ? "fermato" : "finito";
  return `${nome} ${esito}`;
}

/** «Messaggio da <nome sessione>»: il nome sta in `from-name` (o `name`) del tag del messaggio tra sessioni. */
function rigaPeer(attributi: string): string {
  const nome = attributi.match(/\b(?:from-name|name)="([^"]*)"/)?.[1].trim();
  return `Messaggio da ${nome ? (nome.length > 60 ? `${nome.slice(0, 59)}…` : nome) : "un'altra sessione"}`;
}

/** Le righe evento di un testo utente (notifiche di fine attività, messaggi da altre sessioni) e quel che resta, tolte. */
export function notifiche(testo: string): { righe: string[]; resto: string } {
  const righe: string[] = [];
  const r = testo.replace(RE_EVENTO, (_, corpo, tag, attributi) => { righe.push(tag ? rigaPeer(attributi) : rigaNotifica(corpo)); return ""; });
  return { righe, resto: righe.length ? senzaSistema(r.trim()) : testo }; // tolti gli eventi, i blocchi dell'harness in mezzo ora sono in testa
}
