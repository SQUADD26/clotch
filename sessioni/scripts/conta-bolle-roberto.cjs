// Sola lettura (#484): passa ogni trascrizione di ogni account dal convertitore e conta le bolle di Roberto che iniziano con «<».
// Uso: npm run build && node scripts/conta-bolle-roberto.cjs [quante-righe-esempio]
const fs = require("fs"), path = require("path"), os = require("os");
const { Convertitore } = require("../dist/src/messaggi-claude");
const { notifiche } = require("../dist/src/messaggi-sistema");
const radici = new Set();
for (const d of fs.readdirSync(os.homedir())) {
  if (d !== ".claude" && !d.startsWith(".claude-")) continue;
  try { radici.add(fs.realpathSync(path.join(os.homedir(), d, "projects"))); } catch { /* account senza projects */ }
}
let righe = 0, bolle = 0, con = 0;
const tag = {}, esempi = [];
const quanti = Number(process.argv[2] ?? 5);
for (const radice of radici) for (const prog of fs.readdirSync(radice)) {
  let nomi; try { nomi = fs.readdirSync(path.join(radice, prog)).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
  for (const f of nomi) {
    const conv = new Convertitore();
    for (const l of fs.readFileSync(path.join(radice, prog, f), "utf8").split("\n")) {
      if (!l) continue;
      let o; try { o = JSON.parse(l); } catch { continue; }
      righe++;
      for (const m of conv.riga(o).nuovi) {
        if (m.tipo !== "utente") continue;
        bolle++;
        const t = notifiche(m.testo).resto.trimStart(); // le notifiche diventano righe evento, non bolle
        if (!t.startsWith("<")) continue;
        con++;
        const n = t.match(/^<([^\s>]*)/)[1];
        tag[n] = (tag[n] ?? 0) + 1;
        if (esempi.length < quanti && !/^<(pasted_content|bash-input)/.test(t)) esempi.push(`${f}: ${t.slice(0, 120).replace(/\n/g, "⏎")}`);
      }
    }
  }
}
console.log({ radici: [...radici], righe, bolleRoberto: bolle, cheIniziaConMinore: con });
console.log(Object.entries(tag).sort((a, b) => b[1] - a[1]).slice(0, 25));
console.log(esempi.join("\n"));
