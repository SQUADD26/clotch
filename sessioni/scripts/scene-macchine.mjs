// Scene di prova delle macchine SSH (#479): `node scripts/scene-macchine.mjs` parte da design/scene/101-36642.json e scrive i frame 149-*.
// Lo stato della vista viaggia nella `sezione` (chiavi: menu, suggerimento, dialogo, rimuovi, ambiente, testo; vedi NuovaSessione.tsx e DialogoMacchina.tsx).
// Le macchine le darebbe il comando `macchine` (scena.macchine), l'avanzamento sono eventi `macchina_passo` nel registro.
import { readFileSync, writeFileSync } from "node:fs";

const cartella = new URL("../design/scene/", import.meta.url);
const base = JSON.parse(readFileSync(new URL("101-36642.json", cartella), "utf8"));
const RADICE = "/Users/roberto/Repos";
const nomi = ["goal-notch", "claude-config", "squadd-v2", "dentalspace", "clotch-ai-mac-v2", "appunti"];
const recenti = nomi.map((nome) => ({ percorso: `${RADICE}/${nome}`, nome }));
const rami = ["dev", "main", "feat/437-app-completa-ripresa"];
const contesti = Object.fromEntries(recenti.map((c) => [c.percorso, { git: true, rami, predefinito: "dev" }]));

const voce = (nome, utente, x = {}) => ({ nome, host: nome, porta: 22, utente, chiave: null, cartella: "/srv/clotch", stato: "pronta", fonte: "app", locale: false, passo: null, testo: null, comando: null, ...x });
const mac = { ...voce("mac", "roberto", { fonte: "tabella", locale: true, cartella: "/Users/roberto" }) };
const macchine = [mac, voce("rise", "roberto", { fonte: "tabella" }), voce("worker", "roberto"),
  voce("dentalspace-vps", "roberto", { stato: "da_completare", passo: "claude", testo: "Claude non è installato. Il comando claude non esiste su dentalspace-vps." })];
const proposte = [
  { desktop_id: "d-build", nome: "build-server", host: "10.0.4.21", porta: 22, utente: "deploy", chiave: "~/.ssh/id_ed25519" },
  { desktop_id: "d-studio", nome: "mac-studio", host: "mac-studio.local", porta: 22, utente: "roberto", chiave: null },
];

const N = "build-server";
const passo = (passo, ok, x = {}) => ({ nome: N, passo, ok, testo: null, comando: null, url: null, codice: null, t: 1, ...x });
const fatti = [passo("connessione", true), passo("python", true, { testo: "3.11.2" }), passo("cartella", true)];
const eventi = {
  preparazione: [...fatti.slice(0, 2), passo("cartella", null)],
  fallito: [...fatti, passo("claude", false, { testo: "Claude non è installato. Il comando claude non esiste su build-server. Installalo sulla macchina, poi riprova." })],
  login: [...fatti, passo("claude", true, { testo: "2.1.4" }), passo("motore", true), passo("login", false, { comando: "ssh -t deploy@10.0.4.21 'claude login'" })],
  pronta: [...fatti, passo("claude", true, { testo: "2.1.4" }), passo("motore", true), passo("login", true), passo("github", true)],
  ripresa: [...fatti, passo("claude", null)],
  github: [...fatti, passo("claude", true, { testo: "2.1.4" }), passo("motore", true), passo("login", true), passo("github", null, { url: "https://github.com/login/device", codice: "8F3A-21C7" })],
};

function scena(id, sezione, { vuoto = false, passi = [] } = {}) {
  const dati = structuredClone(base);
  // i tempi della scena base sono assoluti: portati a «adesso», clotch AI risulta attiva e l'ordine dei progetti resta quello del disegno
  const sposta = Date.now() - 60_000 - Math.max(...dati.elenco.sessioni.map((x) => x.ultimaAttivita));
  dati.elenco.sessioni.forEach((x) => { x.ultimaAttivita += sposta; });
  Object.values(dati.registro.chat).forEach((c) => { for (const k of ["visto", "battito"]) if (c[k]) c[k] += sposta; });
  dati.registro.passiMacchina = passi;
  dati.navigazione = { vista: "nuova-sessione", sezione };
  dati.nuova = { recenti, casa: "/Users/roberto", contesti };
  dati.macchine = vuoto ? { macchine: [mac], proposte: [] } : { macchine, proposte };
  writeFileSync(new URL(`149-${id}.json`, cartella), JSON.stringify(dati, null, 1) + "\n");
}

scena("67470", "menu:ssh");
scena("67503", "menu:ssh", { vuoto: true });
scena("67536", "dialogo:vuoto");
scena("67568", "dialogo:proposta");
scena("67600", "dialogo:nome");
scena("67632", "dialogo:preparazione", { passi: eventi.preparazione });
scena("67664", "dialogo:fallito", { passi: eventi.fallito });
scena("67696", "dialogo:login", { passi: eventi.login });
scena("67728", "dialogo:pronta", { passi: eventi.pronta });
scena("67760", "rimuovi:worker");
scena("69920", "menu:ssh|suggerimento:rise");
scena("69953", "ambiente:dentalspace-vps|testo:Controlla i test del motore");
scena("69985", "dialogo:ripresa", { passi: eventi.ripresa });
scena("70649", "dialogo:github", { passi: eventi.github });
