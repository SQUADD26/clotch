// Ritardo della ricerca ⌘K con tante sessioni (#1144): con 1500+ sessioni vere il passaggio del mouse era «inusabile», i dati finti piccoli lo nascondevano.
// Misura dal gesto alla riga evidenziata (passaggio del mouse, freccia) e dal tasto ai risultati, con N sessioni finte. Esce 1 sopra i tetti.
// Uso: npm run build && node test/beta/ritardo.mjs [--sessioni 3000]
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { avvia, configura, preparaScena, schermo } from './avvio.mjs';

const i = process.argv.indexOf('--sessioni'), N = i > 0 ? +process.argv[i + 1] : 3000;
const TETTO = { passaggio: 16, freccia: 16, tasto: 50 }; // ms, mediana
const PROGETTI = ['clotch', 'squadd-v2', 'dentalspace', 'claude-config', 'rise'];

await schermo();
const dir = mkdtempSync(join(tmpdir(), 'clotch-ritardo-'));
const f = preparaScena('barra', { dati: 'con' }, dir), s = JSON.parse(readFileSync(f, 'utf8')), base = s.elenco.sessioni[0], ora = Date.now();
s.elenco.sessioni = Array.from({ length: N }, (_, k) => ({ ...base, id: `v${k}`, titolo: `Sessione ${k} di ${PROGETTI[k % 5]}: lavoro numero ${k * 7}`, progetto: PROGETTI[k % 5], stato: 'finita', ultimaAttivita: ora - k * 600_000, obiettivo: null, situazione: null }));
writeFileSync(f, JSON.stringify(s));

const app = await avvia(f);
const mediana = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const esito = {};
try {
  await configura(app, { misura: 'grande', tema: 'scuro', ridotto: false });
  const { pagina } = app;
  await pagina.locator('.pezzo-barra').getByText('Cerca sessioni', { exact: true }).first().click();
  await pagina.waitForSelector('.finestra-ricerca .risultato');
  // tempo dal gesto al primo cambio del DOM che lo mostra (commit di React), più il fotogramma dopo
  const misura = (gesto) => pagina.evaluate(async ({ gesto, giri }) => {
    const lista = document.querySelector('.finestra-ricerca .risultati'), campo = document.querySelector('.finestra-ricerca input');
    const tempi = [];
    for (let k = 0; k < giri; k++) {
      const righe = lista.querySelectorAll('.risultato');
      const t = await new Promise((ok) => {
        const mo = new MutationObserver(() => { mo.disconnect(); ok(performance.now() - t0); });
        mo.observe(lista, { subtree: true, attributes: true, childList: true, characterData: true });
        const t0 = performance.now();
        if (gesto === 'passaggio') righe[(k % 8) + 1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        else if (gesto === 'freccia') campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        else {
          const v = k % 2 ? '' : 'sessione 1'.slice(0, (k % 9) + 1);
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(campo, v);
          campo.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      tempi.push(t);
      await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 30)));
    }
    return tempi;
  }, { gesto, giri: 20 });
  for (const g of ['passaggio', 'freccia', 'tasto']) esito[g] = await misura(g);
  const righe = await pagina.locator('.finestra-ricerca .risultato').count();
  console.log(`${N} sessioni, ${righe} righe disegnate senza testo`);
  // la riga scelta senza barra d'accento (#1151) e l'ordine per ultima attività (#1152): le sessioni finte sono già in ordine v0, v1, …
  const { ombra, ordinate } = await pagina.evaluate(() => ({
    ombra: getComputedStyle(document.querySelector('.finestra-ricerca .scelta')).boxShadow,
    ordinate: [...document.querySelectorAll('.finestra-ricerca .risultato .testo:first-child')].slice(0, 3).map((e) => e.textContent.split(' ')[1]).join(','),
  }));
  esito.accento = ombra === 'none'; esito.ordine = ordinate === '0,1,2';
} finally { await app.chiudi(); }

let rosso = false;
for (const [g, ok, cosa] of [['accento', esito.accento, 'riga scelta senza barra d\'accento'], ['ordine', esito.ordine, 'senza testo, dalla più recente']]) {
  rosso ||= !ok;
  console.log(`${ok ? 'OK ' : 'ROSSO'} ${cosa}`);
  delete esito[g];
}
for (const [g, t] of Object.entries(esito)) {
  const m = mediana(t), ok = m < TETTO[g];
  rosso ||= !ok;
  console.log(`${ok ? 'OK ' : 'ROSSO'} ${g}: mediana ${m.toFixed(1)} ms, massimo ${Math.max(...t).toFixed(1)} ms (tetto ${TETTO[g]} ms)`);
}
process.exit(rosso ? 1 : 0);
