// Conta i «Progetti» della barra sui dati veri (sola lettura): usa leggiElenco dal codice compilato (dist/). Uso: node scripts/conta-progetti.cjs [--elenco]
const os = require("node:os");
const path = require("node:path");
const { leggiElenco } = require("../dist/src/elenco.js");

const tmp = [os.tmpdir(), "/tmp", "/private/tmp", "/var/folders", "/private/var/folders"];
const classe = (s) => {
  const c = s.cartella || "";
  if (/\/\.claude\/worktrees\/[^/]+/.test(c)) return "worktree";
  if (/^scratch-\d{4}-\d{2}-\d{2}-/.test(path.basename(c))) return "scratch";
  if (tmp.some((t) => c === t || c.startsWith(t + "/"))) return "temporanea";
  if (/(^|\s)PROVA-/.test(s.titolo) || /CLOTCH_TEST/.test(s.titolo)) return "prova";
  return "vera";
};

const { sessioni, errori } = leggiElenco({ home: os.homedir() });
const gruppi = new Map(); // progetto -> { n, classi }
const per = {};
for (const s of sessioni) {
  const k = classe(s);
  const g = gruppi.get(s.progetto) ?? { n: 0, classi: new Set() };
  g.n++; g.classi.add(k); gruppi.set(s.progetto, g);
  (per[k] ??= { sessioni: 0, progetti: new Set() }).sessioni++; per[k].progetti.add(s.progetto);
}
console.log(`sessioni=${sessioni.length} progetti(gruppi)=${gruppi.size} errori=${errori.length}`);
for (const [k, v] of Object.entries(per)) console.log(`  ${k.padEnd(12)} sessioni=${String(v.sessioni).padStart(4)} gruppi=${v.progetti.size}`);
const soloDi = (k) => [...gruppi].filter(([, g]) => g.classi.size === 1 && g.classi.has(k)).length;
console.log(`gruppi fatti solo di: worktree=${soloDi("worktree")} temporanea=${soloDi("temporanea")} scratch=${soloDi("scratch")} prova=${soloDi("prova")} vera=${soloDi("vera")}`);
if (process.argv.includes("--elenco")) for (const [p, g] of [...gruppi].sort((a, b) => b[1].n - a[1].n)) console.log(`${String(g.n).padStart(4)}  ${p}  [${[...g.classi]}]`);
