// Dettatura dell'app (#470, Clotch spento): il microfono lo apre solo l'eseguibile nativo (native/dettatura.swift), mai la pagina.
// Il suo stdout (una riga = il testo capito finora) arriva al renderer su «clotch-ai:dettatura».
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { provaSilenziosa } from "./modalita-prova";

/** `testo`: quello capito finora; `fine`: l'eseguibile è finito, con `errore` (testo per Roberto) se non è andata. */
export type EventoDettatura = { testo: string } | { fine: true; errore?: string };

// CLOTCH_DETTATURA_BIN: nelle prove un eseguibile finto; in prova silenziosa senza di lui il microfono vero non si apre mai.
const eseguibile = () => process.env.CLOTCH_DETTATURA_BIN || (provaSilenziosa() ? "" : path.join(__dirname, "..", "..", "bin", "dettatura"));

let figlio: ChildProcess | null = null;

export function avviaDettatura(invia: (e: EventoDettatura) => void) {
  if (figlio) return;
  const bin = eseguibile();
  if (!bin) return invia({ fine: true, errore: "Dettatura non disponibile" });
  const c = figlio = spawn(bin, [], { stdio: ["ignore", "pipe", "pipe"] });
  let resto = "", errori = "";
  const finito = (errore?: string) => { if (figlio !== c) return; figlio = null; invia({ fine: true, ...(errore ? { errore } : {}) }); };
  c.stdout.on("data", (d) => { const righe = (resto + d).split("\n"); resto = righe.pop()!; righe.forEach((testo) => figlio === c && invia({ testo })); });
  c.stderr.on("data", (d) => { errori += d; });
  c.on("error", () => finito("Dettatura non disponibile"));
  c.on("close", (codice) => finito(codice ? errori.trim() || "Dettatura interrotta" : undefined));
}

/** «Fine» o «Detta» di nuovo: ferma l'eseguibile senza altri eventi (il renderer ha già l'ultimo testo). */
export function fermaDettatura() {
  const c = figlio;
  figlio = null;
  c?.kill();
}
