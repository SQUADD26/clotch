// Scene di prova di «Nuova sessione» (#468): `node scripts/scene-nuova.mjs` parte da design/scene/101-36642.json (la barra con i progetti)
// e scrive i frame 148-*. Lo stato della vista viaggia nella `sezione` (chiavi: menu, cerca, cartella, worktree; vedi NuovaSessione.tsx).
import { readFileSync, writeFileSync } from "node:fs";

const cartella = new URL("../design/scene/", import.meta.url);
const base = JSON.parse(readFileSync(new URL("101-36642.json", cartella), "utf8"));
const RADICE = "/Users/roberto/Repos";
const nomi = ["goal-notch", "claude-config", "squadd-v2", "dentalspace", "clotch-ai-mac-v2", "appunti"];
const recenti = nomi.map((nome) => ({ percorso: nome === "appunti" ? "/Users/roberto/appunti" : `${RADICE}/${nome}`, nome }));
const rami = ["dev", "main", "feat/437-app-completa-ripresa", "fix/463-avvio-rapido", "design/332-sessioni-figma", "test/437-parita-finale"];
const contesti = Object.fromEntries(recenti.map((c) => [c.percorso, c.nome === "appunti" ? { git: false, rami: [], predefinito: null } : { git: true, rami, predefinito: "dev" }]));

function scena(id, sezione) {
  const dati = structuredClone(base);
  // i tempi della scena base sono assoluti: portati a «adesso», clotch AI risulta attiva e l'ordine dei progetti resta quello del disegno
  const sposta = Date.now() - 60_000 - Math.max(...dati.elenco.sessioni.map((x) => x.ultimaAttivita));
  dati.elenco.sessioni.forEach((x) => { x.ultimaAttivita += sposta; });
  Object.values(dati.registro.chat).forEach((c) => { for (const k of ["visto", "battito"]) if (c[k]) c[k] += sposta; });
  dati.navigazione = { vista: "nuova-sessione", sezione };
  dati.nuova = { recenti, casa: "/Users/roberto", contesti, ssh: ["rise", "worker"] };
  writeFileSync(new URL(`148-${id}.json`, cartella), JSON.stringify(dati, null, 1) + "\n");
}

scena("51982", "vuota");
scena("52243", "menu:ambiente");
scena("52543", "menu:cartella");
scena("52864", "menu:ramo|cerca:437");
scena("53138", "worktree:spento");
scena("53399", "cartella:appunti");
