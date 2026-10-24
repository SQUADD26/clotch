// Scene del filo compatto (#876): `node scripts/scene-compatto.mjs` scrive design/scene/163-<id>.json per le schermate scure della Section 163:84102
// (al lavoro 87265, gruppo aperto 87853, errore e rapporto 88741, elenco lunghissimo 89329, riduci movimento 90075, finestra stretta 90645)
// e per i fogli dei pezzi, che si disegnano da soli (chat/varianti-compatto.tsx). Parte dalla scena 101-14631 (scene-chat.mjs la scrive prima):
// stessa sessione al lavoro, stessa barra. I testi sono quelli dei frame; i tempi sono relativi ad adesso.
import { readFileSync, writeFileSync } from "node:fs";

const file = (id) => new URL(`../design/scene/163-${id}.json`, import.meta.url);
const base = JSON.parse(readFileSync(new URL("../design/scene/101-14631.json", import.meta.url), "utf8"));
const ORA = Date.now();

// passi: [messaggio, secondi fino al passo dopo]; l'ultimo finisce adesso
function messaggi(passi) {
  let t = ORA - passi.reduce((s, p) => s + p[1], 0) * 1000, n = 0;
  return passi.map(([m, s]) => { const x = { ...m, t }; if (x.tipo === "strumento") x.id ??= `t${n++}`; t += s * 1000; return x; });
}
const u = (testo) => [{ tipo: "utente", testo }, 1];
const a = (testo) => [{ tipo: "assistente", testo, modello: "claude-opus-5-5" }, 1];
const PENSIERO = [{ tipo: "pensiero", testo: "Il filo mostra una riga per ogni strumento. Raggruppo gli strumenti del turno in una riga sola, chiusa. Apro il gruppo solo se Roberto lo chiede. L’errore resta visibile anche col gruppo chiuso." }, 14];
const st = (nome, ingresso, esito, s, errore = false) => [{ tipo: "strumento", nome, ingresso, esito: esito == null ? null : { testo: esito, errore } }, s];
const GH = "gh api 'repos/SQUADD26/gestionale-interno/contents/src/hooks/useRoleAccess.ts?ref=dev' --jq .content | base64 -d";
const CINQUE = [
  st("Grep", { pattern: "canAccess", path: "src" }, "Found 4 files\na\nb\nc\nd", 0.2), st("Read", { file_path: "src/hooks/useRoleAccess.ts" }, "…", 0.3),
  st("Bash", { command: GH }, "", 3), st("Bash", { command: "npm run e2e -- assistenza" }, "Exit code 1", 5, true),
  st("mcp__claude-in-chrome__screenshot", { name: "la pagina Dashboard" }, "ok", 23),
];
const leggi = (f, s = 0.4) => st("Read", { file_path: f }, "…", s);
const DODICI = [...CINQUE, leggi("src/components/AppSidebar.tsx"), leggi("src/components/NavItem.tsx", 0.3), st("Grep", { pattern: "supporto" }, "src/a.ts:1:x", 0.2),
  leggi("src/lib/ruoli.ts", 0.3), leggi("src/pages/Dashboard.tsx", 0.5), st("Bash", { command: "npm run typecheck" }, "ok", 9), leggi("src/hooks/useAuth.ts", 5.6)];
const agente = (description, esito, s, errore = false) => st("Agent", { description, subagent_type: "general-purpose" }, esito, s, errore);
const IN_CORSO = [leggi("sessioni/src/ui/chat/Gruppo.tsx", 1), leggi("sessioni/src/ui/chat/Riga.tsx", 1), st("Read", { file_path: "sessioni/src/ui/chat/Filo.tsx" }, null, 0)];
const RISPOSTA = a("La voce «Assistenza» c’è, ma la barra la nasconde a chi non ha il ruolo «supporto». Il controllo sta in useRoleAccess.ts. Ti propongo di mostrarla a tutti gli admin.");

const scena = (id, passi, sezione) => writeFileSync(file(id), JSON.stringify({
  ...base, navigazione: { ...base.navigazione, ...(sezione ? { sezione } : {}) }, messaggi: { s1: messaggi(passi) } }, null, 1) + "\n");
const DOMANDA = u("Perché la voce «Assistenza» non si vede nella barra?");
const AL_LAVORO = [agente("Controlla i tipi", null, 12), agente("Legge la barra laterale", null, 9), agente("Cerca i ruoli nel database", "Ho trovato 3 ruoli: admin, supporto, ospite.", 4)];

scena("87265", [DOMANDA, PENSIERO, ...DODICI, ...AL_LAVORO, ...IN_CORSO]);
scena("87853", [DOMANDA, PENSIERO, ...CINQUE, RISPOSTA], "aperti:pensiero,strumento|riga:2");
scena("88741", [DOMANDA, PENSIERO, ...DODICI, agente("Controlla i tipi", "Ho controllato i tipi di sessioni/src. Nessun errore. 214 file letti, 0 avvisi. Il comando usato è npm run typecheck.", 8),
  agente("Lancia le prove", "1 prova non riuscita: assistenza.spec.ts", 41, true), RISPOSTA], "aperti:aiutanti");
scena("89329", [DOMANDA, PENSIERO, ...DODICI, ...IN_CORSO], "aperti:strumento|riga:2");
scena("90075", [DOMANDA, ...DODICI, ...AL_LAVORO.slice(0, 2), ...IN_CORSO], "fermo");
scena("90645", [DOMANDA, PENSIERO, ...DODICI, AL_LAVORO[2], RISPOSTA, ...IN_CORSO]);

// fogli dei pezzi: si disegnano da soli coi pezzi veri; la scena serve solo ai canali, vuoti
for (const id of ["84137", "84207", "84216", "84329", "84382", "84565"]) writeFileSync(file(id), JSON.stringify({ navigazione: { vista: "sessione" } }, null, 1) + "\n");
