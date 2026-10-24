// Scene di prova della casella (#437): `node scripts/scene-casella.mjs` parte da design/scene/101-8036.json (la chat di «Sessioni in Electron»)
// e scrive i cinque frame «Casella: …». Lo stato della casella viaggia nella `sezione` (chiavi di `provaDi`, ui/chat/testi.ts).
import { readFileSync, writeFileSync } from "node:fs";

const cartella = new URL("../design/scene/", import.meta.url);
const base = JSON.parse(readFileSync(new URL("101-8036.json", cartella), "utf8"));
const TESTO = "Aggiungi anche lo stato con 200 sessioni";
const COMANDI = [
  ["/clear", "Svuota la conversazione e riparte da zero", "Comandi"], ["/compact", "Riassume la conversazione per fare spazio", "Comandi"],
  ["/context", "Mostra quanto contesto è usato", "Comandi"], ["/cost", "Mostra il consumo della sessione", "Comandi"],
  ["/model", "Cambia il modello della sessione", "Comandi"], ["/code-review", "Rivede le modifiche del ramo", "Comandi"],
].map(([nome, descrizione, gruppo]) => ({ nome, descrizione, gruppo }));
const FILE = ["sessioni/src/lettore.ts", "sessioni/src/lettore.test.ts", "sessioni/src/lettura/cartelle.ts", "sessioni/src/elenco.ts"];

function scena(id, sezione, extra = {}) {
  const dati = structuredClone(base);
  dati.navigazione.sezione = sezione;
  Object.assign(dati.elenco.sessioni[0], { permessi: "default", contesto: 124000 }); // 62% di 200 000
  dati.registro.chat.s1 = { chat: "s1", coda: [], richieste: [], aiutanti: {}, passi: [], contestoMax: 200_000 }; // la finestra la dà il motore (contesto_max, #475)
  writeFileSync(new URL(`101-${id}.json`, cartella), JSON.stringify({ ...dati, ...extra }, null, 1) + "\n");
}

scena("26745", "scritta:/co", { comandi: COMANDI });
scena("27018", "scritta:Guarda @lett", { file: FILE });
scena("26140", `scritta:${TESTO}|menu:permessi|tooltip`);
scena("26427", `scritta:${TESTO}|menu:modello`);
scena("27528", `scritta:${TESTO}|errore:Non inviato: la sessione non risponde.`);
