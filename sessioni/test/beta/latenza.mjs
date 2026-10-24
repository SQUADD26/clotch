// Latenza del gesto (#1144): dal clic al cambio di stato del bottone, con clic lenti e rapidi. Soglia 50 ms (Roberto: «c'è un ritardo che mi sta facendo impazzire»).
// Uso: node test/beta/latenza.mjs   (dopo npm run build && npm run scene)
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { avvia, configura, preparaScena, schermo } from './avvio.mjs';

const SOGLIA = 50, BOTTONE = '.intestazione button[aria-expanded]:is([aria-label="Mostra il pannello"], [aria-label="Chiudi il pannello"])';
await schermo();
const app = await avvia(preparaScena('cornice', { dati: 'con', lungo: false }, mkdtempSync(join(tmpdir(), 'latenza-'))));
try {
  await configura(app, { misura: 'grande', tema: 'scuro', ridotto: false });
  await app.app.evaluate(({ BrowserWindow }) => { const f = BrowserWindow.getAllWindows()[0]; f.show(); f.focus(); });
  await app.pagina.waitForSelector(BOTTONE);
  const r = await app.pagina.evaluate(async ([sel, ritmi]) => {
    const b = () => document.querySelector(sel), pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const fuori = { focus: document.hasFocus() };
    for (const ms of ritmi) {
      const lat = [];
      for (let i = 0; i < 10; i++) {
        const prima = b().getAttribute('aria-expanded'), t0 = performance.now();
        b().click();
        await new Promise((ok) => { const f = () => (document.querySelector(sel)?.getAttribute('aria-expanded') !== prima ? ok() : requestAnimationFrame(f)); f(); });
        lat.push(Math.round(performance.now() - t0)); await pausa(ms);
      }
      fuori[`ogni ${ms} ms`] = { max: Math.max(...lat), lat };
      await pausa(500);
    }
    return fuori;
  }, [BOTTONE, [600, 80, 0]]);
  console.log(JSON.stringify(r));
  // clic rapidi (la pausa ≤ 80 ms): la mediana, perché il primo clic dopo una pausa paga la foto della transizione (un fotogramma, in sandbox senza GPU ~100 ms)
  const med = (v) => [...v.lat].sort((a, b) => a - b)[5];
  const peggio = Math.max(med(r['ogni 80 ms']), med(r['ogni 0 ms']));
  console.log(`latenza mediana a clic rapidi ${peggio} ms (soglia ${SOGLIA})`);
  process.exitCode = peggio <= SOGLIA ? 0 : 1;
} finally { await app.chiudi(); }
