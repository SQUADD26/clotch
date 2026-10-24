// Posti per gli Electron di prova (#518): al massimo N insieme sulla macchina (CLOTCH_BETA_POSTI, se no un quarto dei core),
// non uno solo: ogni giro ha già Xvfb, HOME e --user-data-dir suoi. Ogni posto è un file col pid del padrone; il posto di un pid morto si libera da solo.
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

const DIR = '/tmp/clotch-electron-posti';
export const POSTI = Math.max(1, Math.floor(+process.env.CLOTCH_BETA_POSTI || availableParallelism() / 4));
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const presi = new Set();
process.on('exit', () => presi.forEach((f) => f()));
const dorme = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Prende un posto (aspetta se sono tutti presi) e torna la funzione che lo libera. Sincrona: va bene sia per prove-dom sia per il cliccatore. */
export function prendiPosto() {
  mkdirSync(DIR, { recursive: true });
  for (let giro = 0; ; giro++) {
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
    if (giro % 15 === 0 && giro) console.log(`aspetto un posto libero in ${DIR} (${POSTI} posti, CLOTCH_BETA_POSTI)`);
    dorme(2000);
  }
}
