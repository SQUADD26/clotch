// Prova di prestazioni dell'app vera (#486): Electron senza finestra visibile (lanciare sotto `xvfb-run -a`), dati finti grandi.
// Misura: prima riga della lista entro PRIMA_RIGA_MS; nessun blocco oltre 50 ms nel main e nel renderer durante raffica, scorrimento e scrittura; CPU bassa a riposo.
// Uso: npm run build && node scripts/budget-avvio.cjs   (esce 1 se un tetto è superato)
// Tetti: ~3× la misura sul codice buono (xvfb, Linux), per la CI più lenta; il codice prima di #474 è ben sopra (vedi la PR).
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { coppia, creaRegistro, creaSessioni, rigaRegistro } = require("../dist/test/budget/dati-finti");

const T = { primaRigaMs: 1000, bloccoMs: 50, primoEventoMs: 150, bloccoMainMax: 0, bloccoRendererMax: 0, cpuRiposoPct: 5 };
const N = Number(process.env.BUDGET_SESSIONI || 3000), PER_GIRO = Number(process.env.BUDGET_PER_GIRO || 2), PORTA = 9400 + (process.pid % 500);
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const radice = path.join(__dirname, "..");

async function cdp(porta, tempoMax = 15000) {
  const fine = Date.now() + tempoMax;
  while (Date.now() < fine) {
    try {
      const t = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((x) => x.type === "page");
      if (t) {
        const ws = new WebSocket(t.webSocketDebuggerUrl);
        await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
        let n = 0;
        const attese = new Map();
        ws.onmessage = (m) => { const d = JSON.parse(m.data); attese.get(d.id)?.(d); attese.delete(d.id); };
        return { valuta: (espressione) => new Promise((ok) => { const id = ++n; attese.set(id, ok); ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression: espressione, awaitPromise: true, returnByValue: true } })); }).then((r) => r.result?.result?.value), chiudi: () => ws.close() };
      }
    } catch { /* l'app non è ancora in ascolto */ }
    await pausa(10);
  }
  throw new Error("finestra non raggiungibile");
}

const cpuAlbero = (radicePid) => {
  const figli = new Map(), tick = new Map();
  for (const p of fs.readdirSync("/proc").filter((n) => /^\d+$/.test(n))) {
    try {
      const s = fs.readFileSync(`/proc/${p}/stat`, "utf8"), c = s.slice(s.lastIndexOf(")") + 2).split(" "); // c[1] = ppid, c[11] = utime, c[12] = stime
      figli.set(+p, +c[1]); tick.set(+p, +c[11] + +c[12]);
    } catch { /* processo finito */ }
  }
  const nell = (p) => p === radicePid || (figli.has(p) && figli.get(p) !== p && figli.get(p) !== 1 && nell(figli.get(p)));
  return [...tick].filter(([p]) => nell(p)).reduce((n, [, t]) => n + t, 0) / 100; // secondi di processore
};

async function avvia(etichetta, home, cfg, sonda) {
  const t0 = Date.now();
  const proc = spawn(require("electron"), ["--no-sandbox", `--remote-debugging-port=${PORTA}`, "-r", path.join(__dirname, "..", "test", "budget", "sonda-main.cjs"), radice],
    { env: { ...process.env, HOME: home, XDG_CONFIG_HOME: cfg, CLOTCH_TEST_SILENT: "1", CLOTCH_TEST_ANTEPRIMA: "1", SONDA_FILE: sonda }, stdio: "ignore" });
  const pagina = await cdp(PORTA);
  let primaRiga = null;
  while (primaRiga === null && Date.now() - t0 < 30000) {
    if (await pagina.valuta(`!!document.querySelector(".riga-sessione")`)) primaRiga = Date.now() - t0; else await pausa(10);
  }
  console.log(`[${etichetta}] prima riga: ${primaRiga} ms`);
  return { proc, pagina, primaRiga, fermo: async () => { pagina.chiudi(); proc.kill("SIGTERM"); await pausa(300); proc.kill("SIGKILL"); } };
}

const bloccati = (sonda, da) => fs.readFileSync(sonda, "utf8").split("\n").filter(Boolean).map((r) => r.split(" ").map(Number)).filter(([t]) => t >= da);

async function main() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "budget-avvio-")), cfg = path.join(home, "cfg"), sonda = path.join(home, "sonda.txt");
  fs.writeFileSync(sonda, "");
  const { file } = creaSessioni(home, N);
  const reg = creaRegistro(home, 3, 1);
  const errori = [];
  const verifica = (ok, testo) => { console.log(`${ok ? "OK " : "ROSSO"} ${testo}`); if (!ok) errori.push(testo); };
  try {
    // 1. primo avvio, senza cache: la prima riga entro il tetto, poi si aspetta che il worker finisca
    let a = await avvia("senza cache", home, cfg, sonda);
    verifica(a.primaRiga !== null && a.primaRiga < T.primaRigaMs, `prima riga senza cache ${a.primaRiga} ms (tetto ${T.primaRigaMs})`);
    await pausa(8000);
    await a.fermo();
    // 2. avvio con cache, e tutta l'attività sulla stessa istanza
    a = await avvia("con cache", home, cfg, sonda);
    verifica(a.primaRiga !== null && a.primaRiga < T.primaRigaMs, `prima riga con cache ${a.primaRiga} ms (tetto ${T.primaRigaMs})`);
    await pausa(6000);
    await a.pagina.valuta(`window.__lunghi = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lunghi.push([Math.round(performance.timeOrigin + e.startTime), Math.round(e.duration)]))).observe({ type: "longtask" }); 1`);
    let r = reg.ultimo, giro = 0;
    const raffica = async (ms) => { // righe nuove in 12 trascrizioni ogni 200 ms, 4 righe di registro: la voce e le sessioni scrivono insieme
      for (const fine = Date.now() + ms; Date.now() < fine; giro++) {
        file.slice((giro * PER_GIRO) % (N - PER_GIRO), (giro * PER_GIRO) % (N - PER_GIRO) + PER_GIRO).forEach((f, i) => fs.appendFileSync(f, coppia(path.basename(f, ".jsonl"), 20_000 + giro * PER_GIRO + i)));
        for (let k = 0; k < 4; k++) fs.appendFileSync(reg.file, rigaRegistro(++r));
        await pausa(200);
      }
    };
    const scorri = (ms) => a.pagina.valuta(`new Promise((ok) => { const el = document.querySelector(".pezzo-barra .elenco"); const fine = performance.now() + ${ms};
      const passo = () => { if (el) el.scrollTop = (el.scrollTop + 97) % Math.max(1, el.scrollHeight - el.clientHeight); performance.now() < fine ? requestAnimationFrame(passo) : ok(!!el); }; passo(); })`);
    const fasi = {
      "primo evento dopo l'avvio": async () => { fs.appendFileSync(file[0], coppia("primo", 19_999)); await pausa(1500); }, // il primo giro rilegge ogni file (osserva.ts, CONTROLLO_MS): più largo, ma con un tetto
 raffica: () => raffica(4000), scorrimento: () => scorri(4000), "scrittura (voce che scrive ogni secondo)": async () => { for (let i = 0; i < 4; i++) { for (let k = 0; k < 2; k++) fs.appendFileSync(reg.file, rigaRegistro(++r)); await pausa(1000); } } };
    for (const [nome, vai] of Object.entries(fasi)) {
      const da = Date.now();
      const ok = await vai();
      await pausa(500);
      if (nome === "scorrimento") verifica(ok === true, "la lista si è potuta scorrere (.pezzo-barra .elenco esiste)");
      const main = bloccati(sonda, da).filter(([t]) => t >= da), rend = (await a.pagina.valuta(`window.__lunghi`)).filter(([t]) => t >= da).map((x) => x[1]);
      console.log(`${nome}: blocchi main >${T.bloccoMs} ms ${JSON.stringify(main.map((x) => `${x[1]} ms a +${x[0] - da} ms`))}; renderer ${JSON.stringify(rend)}`);
      const lim = nome.startsWith("primo") ? T.primoEventoMs : T.bloccoMs, sopra = main.filter(([, ms]) => ms > lim);
      verifica(sopra.length <= T.bloccoMainMax, `${nome}: main ${sopra.length} blocchi oltre ${lim} ms (tetto ${T.bloccoMainMax})`);
      verifica(rend.length <= T.bloccoRendererMax, `${nome}: renderer ${rend.length} blocchi oltre ${T.bloccoMs} ms (tetto ${T.bloccoRendererMax})`);
    }
    // riposo
    await pausa(3000);
    const c0 = cpuAlbero(a.proc.pid); await pausa(5000); const cpu = (cpuAlbero(a.proc.pid) - c0) / 5 * 100;
    verifica(cpu < T.cpuRiposoPct, `processore a riposo ${cpu.toFixed(1)}% di un core (tetto ${T.cpuRiposoPct}%)`);
    await a.fermo();
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
  console.log(errori.length ? `ROSSO: ${errori.length} tetti superati` : "VERDE: tutti i tetti rispettati");
  process.exit(errori.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
