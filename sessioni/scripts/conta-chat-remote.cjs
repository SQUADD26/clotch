// Conta sui dati veri (sola lettura) le chat delle sessioni dell'app Claude su una macchina SSH (#1001): quante si aprono subito (trascrizione già sul Mac,
// copia dell'app Claude o del motore) e quante hanno bisogno di `trascrizione_remota`. Usa leggiElenco dal codice compilato (dist/). Uso: node scripts/conta-chat-remote.cjs
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { leggiElenco } = require("../dist/src/elenco.js");

const home = os.homedir();
const { sessioni } = leggiElenco({ home, conProve: true });
const remote = sessioni.filter((s) => s.sorgente === "claude-desktop" && s.app?.ospite);
const subito = remote.filter((s) => s.file.endsWith(".jsonl"));
const delMotore = subito.filter((s) => s.file.startsWith(path.join(home, ".claude", "casella", "trascrizioni")));
const motore = remote.filter((s) => !s.file.endsWith(".jsonl"));
const lavorano = remote.filter((s) => s.stato === "lavora");
const per = (xs) => xs.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
console.log(`sessioni app su macchina ssh=${remote.length}`);
console.log(`  si aprono subito (copia sul Mac)=${subito.length} (di cui copia del motore=${delMotore.length}, copia dell'app Claude=${subito.length - delMotore.length})`);
console.log(`  hanno bisogno del motore=${motore.length}`);
console.log(`  al lavoro adesso (richiamo ogni 5 s a chat aperta)=${lavorano.length}`);
console.log("per macchina:", JSON.stringify(per(remote.map((s) => s.app.ospite))));
console.log("cartella del motore presente:", fs.existsSync(path.join(home, ".claude", "casella", "trascrizioni")));
