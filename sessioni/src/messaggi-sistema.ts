// Testi che l'harness di Claude Code scrive come messaggi `user` ma che Roberto non ha scritto (#484).
// Marcatori contati su ~/.claude/projects: task-notification 95760, system-reminder 50686, command-name 5200,
// local-command-caveat 5160, command-message 2710, local-command-stdout 1550, fork-boilerplate 1200, scheduled-task 480,
// wake 280, relay 150, ci-monitor-event 140, cross-session-message (solo coda). Restano di Roberto: pasted_content, bash-input.
const NASCOSTI = "system-reminder|command-name|command-message|command-args|local-command-stdout|local-command-stderr|local-command-caveat|scheduled-task|wake|relay|cross-session-message|ci-monitor-event|fork-boilerplate";
// un blocco non chiuso (riga troncata) si porta via il resto: è comunque dell'harness
const RE_NASCOSTI = new RegExp(`<(${NASCOSTI})\\b[^>]*>[\\s\\S]*?(?:</\\1>|$)`, "g");
const RE_NOTIFICA = /<task-notification>([\s\S]*?)(?:<\/task-notification>|$)/g;

/** Toglie i blocchi che l'harness mette nei messaggi dell'utente; se non ne trova ridà il testo identico. */
export function senzaSistema(testo: string): string {
  const r = testo.replace(RE_NASCOSTI, "");
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
