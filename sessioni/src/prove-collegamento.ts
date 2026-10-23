// Prove di collegamento dal vivo (#338): app <> sessioni Claude, clotch AI, Clotch, Codex, su questa macchina.
// Ogni prova stampa verde, fallita o in attesa (col perché). Uscita: 0 tutte verdi, 1 almeno una fallita, 3 qualcuna in attesa.
// Uso: npm run prove [-- claude|clotch-ai|clotch|codex]   (PROVE_CLAUDE=<comando> per le sessioni vere; default claude)
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { leggiElenco } from "./elenco";
import { leggiObiettivi } from "./registri";
import { cartellaRegistro, clotchAcceso, leggiRegistro } from "./clotch-ai";
import { trovaFile } from "./jsonl";
import { Situazione } from "./situazione";

type Esito = "verde" | "fallita" | "attesa";
interface Prova { coppia: string; nome: string; esito: Esito; prova: string }

const home = os.homedir();
const env = process.env;
const ora = Date.now();
const p = (coppia: string, nome: string, esito: Esito, prova: string): Prova => ({ coppia, nome, esito, prova });
const eta = (ms: number) => `${Math.round((ora - ms) / 60000)} min fa`;

function claude(): Prova[] {
  const e = leggiElenco({ home, env, ora });
  const cli = e.sessioni.filter((s) => s.sorgente === "claude-code");
  const app = e.sessioni.filter((s) => s.sorgente === "claude-desktop");
  const senza = cli.filter((s) => !s.situazione).length;
  const out = [
    p("app <> Claude CLI", "il lettore vede le sessioni vere", cli.length && !senza ? "verde" : "fallita",
      `${cli.length} sessioni, ${senza} senza situazione, errori di lettura ${e.errori.length}`),
    p("app <> app Claude", "il lettore vede le sessioni dell'app", app.length ? "verde" : "attesa", // l'app Claude gira sul Mac: dalla sandbox non si vede
      app.length ? `${app.length} sessioni, ${app.filter((s) => s.situazione).length} con trascrizione e situazione` : "nessuna sessione dell'app su questa macchina: provare sul Mac"),
  ];
  return out.concat(sessioniVere());
}

/** Sessioni vere di prova (`claude -p`): mai sul Mac (#1797), una alla volta. */
function sessioniVere(): Prova[] {
  const c = "app <> Claude (sessione vera)";
  if (process.platform === "darwin") return [p(c, "sessione di prova passa per le situazioni", "attesa", "sul Mac le sessioni `claude -p` di prova sono vietate (#1797): lanciare `npm run prove -- claude` su squaddv2")];
  const cmd = env.PROVE_CLAUDE || "claude"; // su squaddv2: PROVE_CLAUDE=claude-prove (token dedicato, max 2 sessioni vive)
  const bin = spawnSync("sh", ["-c", 'command -v "$1"', "sh", cmd], { encoding: "utf8" }).stdout.trim();
  if (!bin) return [p(c, "sessione di prova", "attesa", `comando ${cmd} non trovato su questa macchina`)];
  const casi: [string, string[], string, (s: Situazione, r: any) => boolean][] = [
    ["turno finito", [], "Rispondi solo: ok", (s) => s.adesso === "turno_finito"],
    ["modifica con differenze", ["--allowedTools", "Write"], "Crea il file prova.txt con scritto ciao, poi rispondi solo: fatto", (s) => s.segni.includes("modifica")],
    ["permesso negato", ["--settings", '{"permissions":{"deny":["Bash(echo:*)"]}}'] /* regola di rifiuto: nella sandbox un hook approva i permessi chiesti */, "Esegui con lo strumento Bash: echo ciao. Poi rispondi solo: fatto",
      (s, r) => (r.permission_denials?.length ?? 0) > 0 && (s.segni.includes("negata_da_regola") || s.segni.includes("rifiutata_da_te"))],
  ];
  return casi.map(([nome, extra, prompt, ok]) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prova-sessioni-"));
    try {
      const run = spawnSync(bin, ["-p", prompt, "--model", "haiku", "--output-format", "json", ...extra], { cwd: dir, encoding: "utf8", timeout: 180_000 });
      let r: any;
      try { r = JSON.parse(run.stdout); } catch { return p(c, nome, "fallita", `claude -p non ha dato JSON (uscita ${run.status}): ${run.stderr.slice(0, 160)}`); }
      const s = leggiElenco({ home, env, ora: Date.now() }).sessioni.find((x) => x.id === r.session_id);
      if (!s?.situazione) return p(c, nome, "fallita", `sessione ${r.session_id} non trovata dal lettore`);
      return p(c, nome, ok(s.situazione, r) ? "verde" : "fallita", `sessione ${r.session_id}: ${JSON.stringify(s.situazione)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

async function clotchAi(): Promise<Prova[]> {
  const c = "app <> clotch AI";
  const dir = cartellaRegistro(home, env);
  if (!fs.existsSync(dir)) return [p(c, "legge il registro", "attesa", `manca ${dir}: clotch AI non installata`)];
  const reg = leggiRegistro(home, env);
  const out = [p(c, "legge il registro vero", reg.errori.length ? "fallita" : "verde",
    `${reg.chat.size} chat, ${reg.avvisi.length} avvisi, ${reg.comandi.length} comandi, errori ${JSON.stringify(reg.errori)}`)];
  if (reg.clotchAi?.evento !== "avvio") {
    out.push(p(c, "comando nella casella -> comando_fatto", "attesa", `motore clotch AI spento: ultimo evento del motore ${reg.clotchAi ? `«${reg.clotchAi.evento}» ${eta(reg.clotchAi.t)}` : "mai"}`));
    return out;
  }
  // un comando con un nome fuori elenco: nessun effetto, clotch AI deve rispondere `rifiutato`
  const id = `c-${crypto.randomBytes(6).toString("hex")}`;
  const cmdDir = path.join(home, ".claude", "casella", "comandi");
  fs.mkdirSync(cmdDir, { recursive: true });
  const file = path.join(cmdDir, `${Date.now()}-${id}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ v: 1, id, t: new Date().toISOString(), da: "app", cmd: "prova_collegamento", args: {} }));
  fs.renameSync(`${file}.tmp`, file);
  for (let i = 0; i < 30; i++) {
    const esito = leggiRegistro(home, env).esiti.get(id);
    if (esito) return out.concat(p(c, "comando nella casella -> comando_fatto", esito.esito === "rifiutato" ? "verde" : "fallita", `${id}: ${esito.esito} «${esito.testo}»`));
    await new Promise((r) => setTimeout(r, 1000));
  }
  return out.concat(p(c, "comando nella casella -> comando_fatto", "fallita", `${id}: nessun comando_fatto in 30 s (file ${fs.existsSync(file) ? "ancora nella casella" : "preso"})`));
}

function clotch(): Prova[] {
  const c = "app <> Clotch";
  const reg = leggiRegistro(home, env);
  let vivo: number | null = null; // segnale di oggi di Clotch, fuori dal contratto: ~/.config/voce/clotch toccato mentre la voce è accesa
  try { vivo = fs.statSync(path.join(home, ".config", "voce", "clotch")).mtimeMs; } catch { /* Clotch spento o assente */ }
  const out: Prova[] = [];
  if (!reg.clotch) out.push(p(c, "acceso o spento dal registro", "attesa", `Clotch non scrive ancora l'evento \`clotch\` (contratto v1, sezione 4); oggi il file della voce dice ${vivo ? `acceso, ${eta(vivo)}` : "spento"}`));
  else {
    const acceso = clotchAcceso(reg, ora), fresco = vivo !== null && ora - vivo < 90 * 60_000;
    out.push(p(c, "acceso o spento dal registro", acceso === fresco ? "verde" : "fallita", `registro: ${acceso ? "acceso" : "spento"} (${eta(reg.clotch.t)}); file della voce: ${fresco ? "acceso" : "spento"}`));
  }
  const ultimo = reg.avvisi[reg.avvisi.length - 1];
  out.push(!ultimo ? p(c, "voce che parla (avviso detto_da)", "attesa", "nessun avviso nel registro")
    : p(c, "voce che parla (avviso detto_da)", ["clotch", "app"].includes(ultimo.dettoDa ?? "") ? "verde" : "fallita", `ultimo avviso ${ultimo.id}: detto_da ${ultimo.dettoDa ?? "mancante"}`));
  const dettature = reg.comandi.filter((x) => x.da === "clotch" && (x.cmd === "manda" || x.cmd === "parla"));
  out.push(dettature.length ? p(c, "dettatura da Clotch", "verde", `${dettature.length} comandi da Clotch, ultimo ${dettature[dettature.length - 1].id}`)
    : p(c, "dettatura da Clotch", "attesa", "nessun comando manda/parla con da=clotch nel registro: Clotch non usa ancora la casella"));
  const nomi = fs.existsSync(path.join(home, ".claude", "obiettivi")) ? fs.readdirSync(path.join(home, ".claude", "obiettivi")).filter((n) => n.endsWith(".json")) : [];
  const letti = leggiObiettivi(path.join(home, ".claude"), []);
  out.push(p(c, "obiettivi: stessa fonte di Clotch", nomi.length && letti.size === nomi.length ? "verde" : nomi.length ? "fallita" : "attesa",
    `${nomi.length} file in ~/.claude/obiettivi, ${letti.size} letti; eventi obiettivo nel registro: ${[...reg.chat.values()].filter((x) => x.obiettivo).length} chat`));
  out.push(p(c, "con Clotch spento", "attesa", "serve chiudere Clotch sul Mac di Roberto; il ramo «spento» è provato coi dati in situazioni-clotch-ai.test.ts"));
  return out;
}

function codex(): Prova[] {
  const c = "app <> Codex";
  const file = [path.join(home, ".codex"), env.CODEX_HOME].filter((r): r is string => !!r).flatMap((r) => trovaFile(path.join(r, "sessions"), (n) => /^rollout-.*\.jsonl$/.test(n), []));
  const s = leggiElenco({ home, env, ora }).sessioni.filter((x) => x.sorgente === "codex");
  const out = [file.length
    ? p(c, "il lettore vede i rollout veri", s.length === new Set(file).size && s.every((x) => x.situazione) ? "verde" : "fallita",
      `${new Set(file).size} rollout, ${s.length} sessioni, ${s.filter((x) => x.situazione).length} con situazione`)
    : p(c, "il lettore vede i rollout veri", "attesa", "nessun rollout Codex su questa macchina")];
  const bin = spawnSync("sh", ["-c", "command -v codex"], { encoding: "utf8" }).stdout.trim();
  out.push(p(c, "sessione vera di prova", "attesa", bin ? "da fare: codex exec non ancora collegato alla prova" : "comando codex non installato su questa macchina"));
  return out;
}

async function main() {
  const scelta = process.argv[2];
  const tutte: Record<string, () => Prova[] | Promise<Prova[]>> = { claude, "clotch-ai": clotchAi, clotch, codex };
  const prove: Prova[] = [];
  for (const [k, f] of Object.entries(tutte)) if (!scelta || scelta === k) prove.push(...(await f()));
  const w = Math.max(...prove.map((x) => `${x.coppia} · ${x.nome}`.length));
  for (const x of prove) console.log(`${x.esito.toUpperCase().padEnd(8)} ${`${x.coppia} · ${x.nome}`.padEnd(w)}  ${x.prova}`);
  const n = (e: Esito) => prove.filter((x) => x.esito === e).length;
  console.log(`\nverdi ${n("verde")} · fallite ${n("fallita")} · in attesa ${n("attesa")} · macchina ${os.hostname()}`);
  process.exitCode = n("fallita") ? 1 : n("attesa") ? 3 : 0;
}

main();
