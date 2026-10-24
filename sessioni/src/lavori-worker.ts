// Worker dei lavori pesanti (#474): rileggere una trascrizione cresciuta per l'indice e contare l'uso al giorno, fuori dal processo main.
// Tiene le sue memorie (punto di ripresa delle trascrizioni, byte già letti per l'uso): resta acceso finché vive l'app (lavori.ts).
import { parentPort } from "node:worker_threads";
import { aggiornaVoce, type MemoIndice } from "./indice";
import { usoAlGiorno } from "./quote-uso";

const memo: MemoIndice = new Map();
parentPort?.on("message", async (m) => {
  try {
    if (m.tipo === "voce") {
      const d = m.v ? { [m.s.id]: m.v } : {};
      const cambiata = aggiornaVoce(d, m.s, memo);
      parentPort!.postMessage({ n: m.n, ok: { cambiata, v: d[m.s.id] ?? null } });
    } else if (m.tipo === "uso") parentPort!.postMessage({ n: m.n, ok: await usoAlGiorno(m.radici, m.ora) });
    else throw new Error(`lavoro sconosciuto: ${m.tipo}`);
  } catch (e) { parentPort!.postMessage({ n: m.n, errore: String(e) }); }
});
