// Conta sui dati veri (sola lettura) le sessioni dell'app Claude: senza email e con trascrizione che non si apre (#996).
// Usa leggiElenco/leggiPagina dal codice compilato (dist/). Uso: node scripts/conta-sessioni-app.cjs [--elenco]
const os = require("node:os");
const { leggiElenco } = require("../dist/src/elenco.js");
const { leggiPagina } = require("../dist/src/messaggi.js");

const { sessioni } = leggiElenco({ home: os.homedir(), conProve: true });
const app = sessioni.filter((s) => s.sorgente === "claude-desktop");
const senzaEmail = app.filter((s) => !s.email);
const chiusa = app.map((s) => ({ s, p: leggiPagina(s, 0) })).filter((x) => x.p.errore);
const per = (xs) => xs.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
console.log(`sessioni app=${app.length} senza_email=${senzaEmail.length} trascrizione_che_non_si_apre=${chiusa.length}`);
console.log("senza email per account:", JSON.stringify(per(senzaEmail.map((s) => s.account))));
console.log("non si aprono per errore:", JSON.stringify(per(chiusa.map((x) => x.p.errore))));
console.log("non si aprono, dove gira la sessione:", JSON.stringify(per(chiusa.map((x) => (x.s.app?.ospite ? "host remoto (ssh)" : "questo Mac")))));
if (process.argv.includes("--elenco")) for (const { s, p } of chiusa) console.log(s.account, s.id, s.app?.ospite ?? "-", p.errore);
