// Posti per gli Electron di prova (#518): al massimo N insieme sulla macchina (CLOTCH_BETA_POSTI, se no un quarto dei core:
// con video un Electron pesa più di un core, a metà dei core il carico passava 190 su 96 e M5 saltava, #1139), non uno solo: ogni giro ha già Xvfb, HOME e --user-data-dir suoi. Ogni posto è un file col pid del padrone; il posto di un pid morto si libera da solo.
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

const DIR = '/tmp/clotch-electron-posti';
export const POSTI = Math.max(1, Math.floor(+process.env.CLOTCH_BETA_POSTI || availableParallelism() / 4));
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const presi = new Set();
process.on('exit', () => presi.forEach((f) => f()));
const dorme = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function provaPosto() {
  mkdirSync(DIR, { recursive: true });
  for (let k = 0; k < POSTI; k++) {
    const f = join(DIR, String(k));
    try { writeFileSync(f, String(process.pid), { flag: 'wx' }); } catch {
      const pid = (() => { try { return +readFileSync(f, 'utf8'); } catch { return 0; } })();
      if (pid && !vivo(pid)) try { unlinkSync(f); } catch { /* liberato da un altro */ }
      continue;
    }
    const libera = () => { presi.delete(libera); try { if (readFileSync(f, 'utf8') === String(process.pid)) unlinkSync(f); } catch { /* già libero */ } };
    presi.add(libera);
    return libera;
  }
  return null;
}
const attesa = (giro) => giro % 15 === 0 && giro && console.log(`aspetto un posto libero in ${DIR} (${POSTI} posti, CLOTCH_BETA_POSTI)`);

/** Prende un posto (aspetta se sono tutti presi) e torna la funzione che lo libera. Sincrona: per prove-dom, un Electron per processo. */
export function prendiPosto() {
  for (let giro = 0; ; giro++) { const l = provaPosto(); if (l) return l; attesa(giro); dorme(2000); }
}

/** Come prendiPosto ma aspetta senza fermare il processo: il cliccatore tiene molti Electron insieme e chi ha un posto deve poter finire. */
export async function aspettaPosto() {
  for (let giro = 0; ; giro++) { const l = provaPosto(); if (l) return l; attesa(giro); await new Promise((ok) => setTimeout(ok, 2000)); }
}
