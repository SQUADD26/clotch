// Testi che l'harness di Claude Code scrive come messaggi `user` ma che Roberto non ha scritto (#484).
// Nessun campo della riga li separa dai prompt veri (provato su ~/.claude/projects: origin assente nelle trascrizioni vecchie e
// «human» anche su system-reminder; turnOrigin/promptSource «sdk» anche sui prompt di dispatch; permissionMode presente su tutti),
// quindi la regola è strutturale: un blocco chiuso `<nome-con-trattini>…</nome-con-trattini>` in testa o in coda al testo è dell'harness,
// qualunque sia il nome (anche mai visto). Un nome di una parola sola (`<wake reason=…>`, `<relay from=…>`) conta solo se ha attributi, così `<div>` resta di Roberto.
// Restano di Roberto `<pasted_content>` e `<bash-input>`; `<task-notification>` lo legge `notifiche`.
const NOME = "[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*";
const DI_ROBERTO = new Set(["pasted_content", "bash-input", "task-notification"]);
const IN_TESTA = new RegExp(`^\\s*<(${NOME})(?:\\s[^>]*)?>[\\s\\S]*?</\\1>\\s*`);
const IN_CODA = new RegExp(`\\s*<(${NOME})(?:\\s[^>]*)?>[\\s\\S]*?</\\1>\\s*$`);
const RE_NOTIFICA = /<task-notification>([\s\S]*?)(?:<\/task-notification>|$)/g;

const dellHarness = (m: RegExpExecArray) => !DI_ROBERTO.has(m[1]) && (/[-_]/.test(m[1]) || /^\s*<\S+\s/.test(m[0].trimStart()));

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

/** Le notifiche di fine attività di un testo utente (una riga ciascuna) e quel che resta, tolte le notifiche. */
export function notifiche(testo: string): { righe: string[]; resto: string } {
  const righe: string[] = [];
  const r = testo.replace(RE_NOTIFICA, (_, corpo) => { righe.push(rigaNotifica(corpo)); return ""; });
  return { righe, resto: righe.length ? r.trim() : testo };
}
