// «Ogni bug diventa una voce» (#518): una PR che chiude un'issue `beta-tester` aggiunge in checklist/*.jsonl una voce con "origine":"bug #N".
// Uso (CI): PR_BODY="..." BASE=origin/dev node test/beta/voce-checklist.mjs   (legge le etichette con gh)
import { execFileSync } from 'node:child_process';

const corpo = process.env.PR_BODY ?? '', base = process.env.BASE ?? 'origin/dev';
const chiusi = [...new Set([...corpo.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:SQUADD26\/clotch)?#(\d+)/gi)].map((m) => m[1]))];
const beta = chiusi.filter((n) => {
  try { return execFileSync('gh', ['issue', 'view', n, '-R', 'SQUADD26/clotch', '--json', 'labels', '--jq', '.labels[].name'], { encoding: 'utf8' }).split('\n').includes('beta-tester'); }
  catch (e) { console.error(`issue #${n} non leggibile: ${e.message.split('\n')[0]}`); process.exit(1); }
});
if (!beta.length) { console.log('Nessuna issue beta-tester chiusa: nessuna voce richiesta.'); process.exit(0); }
const aggiunte = execFileSync('git', ['diff', `${base}...HEAD`, '-U0', '--', 'sessioni/test/beta/checklist'], { encoding: 'utf8' }).split('\n').filter((r) => r.startsWith('+{'));
const mancano = beta.filter((n) => !aggiunte.some((r) => new RegExp(`"origine"\\s*:\\s*"bug #${n}\\b`).test(r)));
if (mancano.length) {
  console.error(`La PR chiude l'issue beta-tester ${mancano.map((n) => '#' + n).join(', ')} senza una voce nuova con "origine":"bug #${mancano[0]}" in sessioni/test/beta/checklist/<famiglia>.jsonl.\nId libero: node sessioni/test/beta/controlla-checklist.mjs --prossimo SOV`);
  process.exit(1);
}
console.log(`Voce di checklist presente per ${beta.map((n) => '#' + n).join(', ')}.`);
