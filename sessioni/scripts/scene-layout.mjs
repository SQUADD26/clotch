// Scene di prova delle finestre (101:29280, 101:29399, 101:29552, 101:29770, 101:29971): stessi dati di 101:8036 e 101:8610,
// con la sezione che mette barra e maniglia nello stato del frame. Si lancia dopo scene-chat.mjs (che scrive quelle di partenza).
import { readFileSync, writeFileSync } from "node:fs";

const scena = (da, id, sezione) => {
  const d = JSON.parse(readFileSync(new URL(`../design/scene/101-${da}.json`, import.meta.url), "utf8"));
  const s = [d.navigazione.sezione, sezione].filter(Boolean).join("|");
  writeFileSync(new URL(`../design/scene/101-${id}.json`, import.meta.url), JSON.stringify({ ...d, navigazione: { ...d.navigazione, ...(s ? { sezione: s } : {}) } }, null, 1) + "\n");
};
scena("8036", "29280", "barra-chiusa");
scena("8036", "29399", "maniglia");
scena("8610", "29552", "barra-sopra");
scena("8610", "29770");
scena("8610", "29971");
