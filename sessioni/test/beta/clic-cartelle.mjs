// Ritardo del clic sulle cartelle della barra (#1144): 20 clic di fila sulla stessa cartella, 30 cartelle (CLOTCH_BETA_VOLUME=1).
// Stampa, per ogni clic, i ms dal clic al cambio di aria-expanded (null = il clic è andato perso) e fallisce sopra 100 ms (la sandbox disegna in software: sul Mac meno) o con clic persi.
// Uso: CLOTCH_BETA_VOLUME=1 node test/beta/clic-cartelle.mjs   (prima npm run build e npm run scene)
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { avvia, configura, preparaScena, schermo } from './avvio.mjs';

process.env.CLOTCH_BETA_VOLUME = '1';
await schermo();
const cfg = { tema: 'scuro', misura: 'grande', dati: 'con', lungo: false, ridotto: false };
const app = await avvia(preparaScena('barra', cfg, mkdtempSync(join(tmpdir(), 'clotch-cart-'))));
await configura(app, cfg);
const { pagina } = app;
const riga = pagina.locator('.pezzo-barra .gruppo > .riga[aria-expanded]').nth(3);
const tempi = [];
for (let i = 0; i < 20; i++) {
  const prima = await riga.getAttribute('aria-expanded');
  const t = await pagina.evaluate(() => new Promise((ok) => { /* misura in pagina: dal clic al cambio */ window.__t0 = performance.now(); ok(window.__t0); }));
  await pagina.evaluate((p) => { const el = document.querySelectorAll('.pezzo-barra .gruppo > .riga[aria-expanded]')[3]; window.__ms = null;
    new MutationObserver((_m, o) => { window.__ms = performance.now() - window.__t0; o.disconnect(); }).observe(el, { attributes: true, attributeFilter: ['aria-expanded'] }); window.__t0 = performance.now(); }, 0);
  await riga.click();
  await pagina.waitForTimeout(60);
  tempi.push(await pagina.evaluate(() => window.__ms));
  void prima; void t;
}
console.log('ms per clic:', JSON.stringify(tempi.map((x) => x && Math.round(x))));
const male = tempi.filter((x) => x === null || x > 100).length;
console.log(`${tempi.length} clic, ${male} persi o sopra 100 ms`);
await app.chiudi();
process.exit(male ? 1 : 0);
