// Avvio dell'app vera per il beta tester (#518): Electron di sessioni/ con Playwright `_electron`, una scena di prova al posto dei dati del Mac.
// Come prove-dom.mjs: CLOTCH_TEST_SILENT=1, HOME temporanea dalle fixture, al massimo N Electron insieme (scripts/posti.mjs).
// La finestra si mostra (CLOTCH_TEST_ANTEPRIMA=1, come budget-avvio.cjs): nascosta non avrebbe fotogrammi né foto vere. Va sotto xvfb.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';
import { prendiPosto } from '../../scripts/posti.mjs';

export const RADICE = fileURLToPath(new URL('../../', import.meta.url));
// sandbox senza GTK di sistema: le librerie estratte stanno qui (in CI ci sono già)
const GTK = '/work/r.bondici/gtk/root/usr/lib/x86_64-linux-gnu';

// Area -> scena di partenza (design/scene/<id>.json) e radice CSS dei cliccabili. «cornice» = barra del titolo, fuori dai pezzi.
export const AREE = {
  barra: { scena: '101-8036', radice: '.pezzo-barra', apri: '.barra-titolo [aria-label="Barra laterale"]' }, // a finestra stretta la barra è chiusa: si apre sopra
  chat: { scena: '101-8036', radice: '.pezzo-chat' },
  nuova: { scena: '148-51982', radice: '.nuova-sessione' },
  friday: { scena: '101-16432', radice: '.pezzo-clotch-ai' },
  impostazioni: { scena: '101-17193', radice: '.pezzo-impostazioni' },
  cornice: { scena: '101-8036', radice: '.barra-titolo' },
  // stati di «Nuova sessione» e delle macchine SSH (#524): una scena per stato, `extra` = fuori da `tutto` per non moltiplicare i giri della CI
  ...Object.fromEntries(Object.entries({
    'nuova-cartella': '148-52543', 'nuova-ramo': '148-52864', 'nuova-senza-worktree': '148-53138', 'nuova-senza-git': '148-53399',
    'nuova-ssh': '149-67470', 'nuova-ssh-vuoto': '149-67503', 'nuova-ssh-base': '149-69920', 'nuova-da-completare': '149-69953', 'nuova-togli': '149-67760',
    'nuova-dialogo': '149-67536', 'nuova-proposta': '149-67568', 'nuova-nome': '149-67600', 'nuova-preparazione': '149-67632', 'nuova-fallito': '149-67664',
    'nuova-login': '149-67696', 'nuova-pronta': '149-67728', 'nuova-ripresa': '149-69985', 'nuova-github': '149-70649',
  }).map(([k, scena]) => [k, { scena, radice: '.nuova-sessione', extra: true }])),
};

const finestra = (id) => JSON.parse(readFileSync(join(RADICE, 'design/figma', `${id}.json`), 'utf8')).nodi.find((n) => n.nome === 'finestra').box;
// «min» = la finestra più piccola che la BrowserWindow accetta (frame «Finestra 480»); «grande» = 1440×900 (file comune del collaudo).
export const MISURE = { min: (({ w, h }) => ({ w, h }))(finestra('101-29971')), grande: { w: 1440, h: 900 } };

const LUNGO = 'Collaudo del testo lungo: titolo che non finisce più, con parole vere e senza spazi strani, per vedere tagli ed ellissi ';
const allunga = (s, n) => (s.length >= n ? s : (s + ' · ' + LUNGO.repeat(3)).slice(0, n));
// Testo lungo: titoli e nomi da 120 caratteri, messaggi da 600. Chiavi di testo visibile delle scene (src/scena.ts).
function lungo(x, chiave) {
  if (Array.isArray(x)) return x.map((v) => lungo(v, chiave));
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, lungo(v, k)]));
  if (typeof x !== 'string' || !x) return x;
  if (['titolo', 'nome', 'progetto', 'ramo', 'etichetta'].includes(chiave)) return allunga(x, 120);
  if (['testo', 'frammento', 'perche'].includes(chiave)) return allunga(x, 600);
  return x;
}

/** Scrive la scena del giro: `dati` con|senza, `lungo` sì/no. Senza dati = elenco e messaggi vuoti, nessuna sessione aperta. */
export function preparaScena(area, { dati, lungo: lun }, cartella) {
  let s = JSON.parse(readFileSync(join(RADICE, 'design/scene', `${AREE[area].scena}.json`), 'utf8'));
  if (dati === 'senza') {
    s = { ...s, messaggi: {}, info: {}, archiviate: [], elenco: s.elenco && { ...s.elenco, sessioni: [] } };
    if (s.navigazione) s.navigazione = { vista: s.navigazione.vista };
  }
  // quote d'uso finte (#691): senza, il piede account non ha menu da cliccare. Il primo è l'account della sessione aperta, relativi ad adesso
  const h = 3_600_000, ora = Date.now();
  s.uso ??= [
    { account: 'accountmanager', email: 'accountmanager@example.com', usato: 31, ripartenza: '', cinque: 42, cinqueFine: ora + 2 * h, sette: 31, setteFine: ora + 70 * h },
    { account: 'secondo', email: 'secondo@example.com', usato: 100, ripartenza: '', cinque: 100, cinqueFine: ora + h, sette: 64, setteFine: ora + 40 * h },
    { account: 'terzo', email: 'terzo@example.com', usato: 12, ripartenza: '', cinque: 8, cinqueFine: ora + 4 * h, sette: 12, setteFine: ora + 100 * h },
  ];
  if (lun) { const nav = s.navigazione; s = lungo(s); s.navigazione = nav; }
  const f = join(cartella, `scena-${area}-${dati}${lun ? '-lungo' : ''}.json`);
  writeFileSync(f, JSON.stringify(s));
  return f;
}

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
let libera = () => {};
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { libera(); process.exit(130); });

/** Senza DISPLAY (sandbox, CI) avvia un Xvfb proprio su un numero libero (-displayfd) e lo chiude all'uscita. */
export async function schermo() {
  if (process.env.DISPLAY || process.platform !== 'linux') return;
  const x = spawn('Xvfb', ['-displayfd', '3', '-screen', '0', '1920x1200x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe'] });
  const n = await new Promise((ok, no) => { x.stdio[3].once('data', (d) => ok(String(d).trim())); x.once('error', no); x.once('exit', () => no(new Error('Xvfb non parte'))); });
  process.env.DISPLAY = `:${n}`;
  x.stdio[3].destroy(); x.unref(); // il giro finisce da solo
  process.on('exit', () => x.kill());
}

/** Lancia l'app sulla scena; torna { app, pagina, chiudi }. `video`: cartella dove Playwright registra la finestra. */
export async function avvia(fileScena, { video } = {}) {
  for (const f of ['dist/src/main.js', 'renderer/index.html']) if (!existsSync(join(RADICE, f))) throw new Error(`Manca ${f}: prima npm ci e npm run build.`);
  libera = prendiPosto();
  const home = mkdtempSync(join(tmpdir(), 'clotch-beta-'));
  cpSync(join(RADICE, 'test/fixtures/home'), home, { recursive: true });
  try {
    const app = await _electron.launch({
      executablePath: createRequire(import.meta.url)('electron'),
      args: ['--no-sandbox', '--force-device-scale-factor=1', '--force-color-profile=srgb', `--user-data-dir=${join(home, 'dati-app')}`, RADICE, '--scena', fileScena],
      cwd: RADICE,
      env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'), CLOTCH_TEST_SILENT: '1', CLOTCH_TEST_ANTEPRIMA: '1', ...(existsSync(GTK) && { LD_LIBRARY_PATH: [GTK, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }) },
      ...(video && { recordVideo: { dir: video } }),
      timeout: 60000,
    });
    const pagina = await app.firstWindow();
    await pagina.waitForLoadState('domcontentloaded');
    await pagina.waitForSelector('.cornice:not(.in-avvio)', { timeout: 20000 }).catch(() => {});
    return { app, pagina, chiudi: async () => { await app.close().catch(() => {}); rmSync(home, { recursive: true, force: true }); libera(); } };
  } catch (e) { rmSync(home, { recursive: true, force: true }); libera(); throw e; }
}

/** Porta la finestra alla misura (contenuto), tema e movimento ridotto; aspetta due fotogrammi. */
export async function configura({ app, pagina }, { misura, tema, ridotto }) {
  const { w, h } = MISURE[misura];
  await app.evaluate(({ BrowserWindow }, [w, h]) => { const f = BrowserWindow.getAllWindows()[0]; f.setContentSize(w, h); }, [w, h]);
  await pagina.emulateMedia({ colorScheme: tema === 'chiaro' ? 'light' : 'dark', reducedMotion: ridotto ? 'reduce' : 'no-preference' });
  await pagina.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [w, h], { timeout: 5000 }).catch(() => {});
  await pagina.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
}
