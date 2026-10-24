// Giudice del beta tester (#518): legge i registro.json di un giro di clicca.mjs e esce 1 se resta un difetto nuovo o se il giro non ha prove.
// Un difetto è già noto se una riga di accettati.json ha lo stesso criterio («voce»), la stessa area (o «*») e, se c'è, un pezzo di «dove»,
// e la sua issue `beta-tester` è aperta. Issue chiusa: la riga non vale più e il difetto torna a contare.
// Uso: node test/beta/giudica.mjs <cartella-del-giro>
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('uso: node test/beta/giudica.mjs <cartella-del-giro>'); process.exit(2); }
const accettati = JSON.parse(readFileSync(new URL('./accettati.json', import.meta.url), 'utf8')).accettati;
const stati = new Map();
// shortcut: senza gh o senza rete l'issue vale aperta (il giro locale non diventa rosso per la rete); in CI GH_TOKEN c'è sempre
const aperta = (n) => {
  if (!stati.has(n)) {
    try { stati.set(n, execFileSync('gh', ['issue', 'view', String(n), '-R', 'SQUADD26/clotch', '--json', 'state', '--jq', '.state'], { encoding: 'utf8' }).trim() === 'OPEN'); }
    catch { console.log(`attenzione: stato dell'issue #${n} non leggibile, la tengo aperta`); stati.set(n, true); }
  }
  return stati.get(n);
};
const nota = (d, area) => accettati.find((a) => a.voce === d.criterio && (a.area === '*' || a.area === area) && (!a.dove || d.dove.includes(a.dove)) && aperta(a.issue));

const senzaProva = [], nuovi = new Map(), noti = new Map();
let foto = 0, cliccati = 0, giri = 0;
if (!existsSync(join(dir, 'sommario.json'))) senzaProva.push('manca sommario.json (il cliccatore non è arrivato in fondo)');
for (const area of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []) {
  for (const cfg of readdirSync(join(dir, area), { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'video').map((d) => d.name)) {
    const f = join(dir, area, cfg, 'registro.json');
    if (!existsSync(f)) { senzaProva.push(`${area}/${cfg}: manca registro.json`); continue; }
    const reg = JSON.parse(readFileSync(f, 'utf8')), n = existsSync(join(dir, area, cfg, 'foto')) ? readdirSync(join(dir, area, cfg, 'foto')).filter((x) => x.endsWith('.jpg')).length : 0;
    giri++; foto += n; cliccati += reg.cliccati ?? 0;
    if (!n) senzaProva.push(`${area}/${cfg}: nessuna foto`);
    if (!reg.cliccati) senzaProva.push(`${area}/${cfg}: nessun elemento cliccato`);
    for (const d of reg.difetti) {
      const a = nota(d, area), k = `${area} ${d.criterio} ${d.dove}`;
      if (a) noti.set(`${d.criterio} ${a.dove ?? ''} (#${a.issue})`, true);
      else nuovi.set(k, [...(nuovi.get(k) ?? []), `${cfg}: ${d.valore} [${d.foto ?? '-'}]`]);
    }
  }
}
if (!giri) senzaProva.push('nessun giro nella cartella');
console.log(`## Beta tester clotch\nGià noti, con issue aperta: ${[...noti.keys()].join(', ') || 'nessuno'}`);
if (senzaProva.length) { console.log(`NESSUNA PROVA, giro non valido (rosso): ${senzaProva.join('; ')}`); process.exit(1); }
console.log(`Prova: ${giri} giri, ${cliccati} elementi cliccati, ${foto} foto.`);
if (!nuovi.size) { console.log('Nessun difetto nuovo.'); process.exit(0); }
console.log(`Difetti NUOVI (${nuovi.size}):`);
for (const [k, v] of nuovi) console.log(`- ${k}: ${v.slice(0, 2).join(' | ')}${v.length > 2 ? ` (+${v.length - 2} config)` : ''}`);
console.log('Criteri: sessioni/test/beta/LEGGIMI.md. Un difetto noto con issue `beta-tester` aperta va in sessioni/test/beta/accettati.json.');
process.exit(1);
