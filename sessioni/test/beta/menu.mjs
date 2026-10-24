// Voci dei menu (#1081): per ogni elemento dell'area si apre il suo menu col clic destro, e col clic se dichiara aria-haspopup («⋯»),
// poi si attiva ogni voce una alla volta, con foto e sonde dopo ognuna. Il clic destro si confronta con Maiusc+F10: stesso menu da tastiera.
// Un menu già visto (stesse voci) non si riprova; al massimo MAX_VOCI voci per giro.
const MAX_VOCI = 60;
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const aperto = (pagina) => pagina.evaluate(() => window.__bt.menuAperti());
const voci = (pagina) => pagina.evaluate(() => [...document.querySelectorAll(`:is(${window.__bt.SOPRA}) :is([role=menuitem],[role=menuitemradio],[role=menuitemcheckbox])`)]
  .filter((e) => !e.disabled && e.getAttribute('aria-disabled') !== 'true').map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')));
const chiudi = async (pagina) => { for (let k = 0; k < 3 && (await aperto(pagina)); k++) { await pagina.keyboard.press('Escape'); await pausa(250); } };

/** `g`: { pagina, radice, reg, foto, difetti, segna, pulito, firma0 } del giro di clicca.mjs. */
export async function provaMenu(g) {
  const { pagina, radice, reg } = g, visti = new Set();
  let nomi = await g.segna(), fatte = 0;
  for (let i = 0; i < nomi.length && fatte < MAX_VOCI; i++) {
    const loc = () => pagina.locator(`[data-bt="${i}"]`).first();
    const modi = [['destro', () => loc().click({ button: 'right', timeout: 1500 })]];
    if (await loc().evaluate((e) => /menu|true/.test(e.getAttribute('aria-haspopup') ?? '')).catch(() => false)) modi.push(['clic', () => loc().click({ timeout: 1500 })]);
    for (const [modo, apri] of modi) {
      if (!(await apri().then(() => true, () => false))) continue;
      await pausa(300);
      const elenco = (await aperto(pagina)) ? await voci(pagina) : [];
      const chiave = elenco.join('|');
      if (!elenco.length || visti.has(chiave)) { await chiudi(pagina); continue; }
      visti.add(chiave);
      const f = await g.foto(`menu${i}-${modo}`);
      await g.difetti(`${nomi[i]} › menu (${modo})`, f);
      await chiudi(pagina);
      if (modo === 'destro') { // stesso menu dalla tastiera: Maiusc+F10 sul pezzo col fuoco
        await loc().focus().catch(() => {}); await pagina.keyboard.press('Shift+F10'); await pausa(300);
        if (!(await aperto(pagina))) reg.difetti.push({ criterio: 'TASTIERA-MENU', dove: nomi[i], valore: 'il clic destro apre un menu, Maiusc+F10 no', quando: nomi[i], foto: f });
        await chiudi(pagina);
      }
      for (const voce of elenco) {
        if (fatte++ >= MAX_VOCI) break;
        if (!(await apri().then(() => true, () => false))) break;
        await pausa(300);
        const v = pagina.locator(`:is(${await pagina.evaluate(() => window.__bt.SOPRA)}) :is([role=menuitem],[role=menuitemradio],[role=menuitemcheckbox])`).filter({ hasText: voce }).first();
        if (!(await v.click({ timeout: 1500 }).then(() => true, () => false))) { await chiudi(pagina); continue; }
        await pausa(400);
        const fv = await g.foto(`menu${i}-${modo}-${reg.elementi.length}`);
        reg.elementi.push({ n: `${i}.${voce}`, dove: `${nomi[i]} › ${voce}`, foto: [f, fv] });
        await g.difetti(`${nomi[i]} › ${voce}`, fv);
        await chiudi(pagina);
        // la voce ha cambiato lo stato (rinomina, archivia, nascondi): si riparte pulito perché la voce dopo trovi la stessa riga
        if (await pagina.evaluate((r) => window.__bt.firma(r), radice) !== g.firma0) { await g.pulito(); nomi = await g.segna(); }
      }
    }
  }
}
