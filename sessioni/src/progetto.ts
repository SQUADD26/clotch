// A che «progetto» della barra appartiene una cartella di lavoro (#891): un worktree sta sotto il suo repo,
// le cartelle `scratch-…` di Claude Desktop (chat senza cartella) stanno in un gruppo solo, le prove nelle cartelle temporanee non compaiono.
// Sola lettura: nessun processo, ogni cartella si guarda una volta sola.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { nomeProgetto } from "./claude-code";
import type { Sessione } from "./tipi";

/** Come il menu «Nuova sessione» (MenuAvvio): una chat senza cartella. */
export const SENZA_CARTELLA = "Nessuna cartella";

const SCRATCH = /^scratch-\d{4}-\d{2}-\d{2}-\w+$/;
const WORKTREE = /^(.+?)\/\.claude\/worktrees\/[^/]+/;
const TEMPORANEE = [...new Set([os.tmpdir(), "/tmp", "/private/tmp", "/var/folders", "/private/var/folders"])];

const sotto = (c: string, d: string) => c === d || c.startsWith(d + "/");
const scratch = (cartella: string) => SCRATCH.test(path.basename(cartella));

// shortcut: una cartella cambia da worktree a no solo riavviando l'app; la cache non scade
const radici = new Map<string, string | null>();

/** Il repo principale di un worktree fuori da `.claude/worktrees` (Codex, Cursor…): `.git` è un file `gitdir: <repo>/.git/worktrees/<nome>`,
 *  e `commondir` di quella cartella punta al `.git` del repo (è `git rev-parse --git-common-dir`, letto dai file). */
function repoDelWorktree(cartella: string): string | null {
  if (radici.has(cartella)) return radici.get(cartella)!;
  let repo: string | null = null;
  try {
    const gitdir = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(path.join(cartella, ".git"), "utf8"))?.[1].trim();
    if (gitdir) {
      const dir = path.resolve(cartella, gitdir);
      const comune = path.resolve(dir, fs.readFileSync(path.join(dir, "commondir"), "utf8").trim());
      if (path.basename(comune) === ".git") repo = path.dirname(comune); // un submodulo non ha commondir: resta com'è
    }
  } catch { /* non è un worktree, o la cartella non c'è più */ }
  radici.set(cartella, repo);
  return repo;
}

/** Il nome del progetto di una sessione con questa cartella di lavoro. */
export function progettoDi(cartella: string): string {
  const c = cartella.replace(/\/+$/, "");
  if (scratch(c)) return SENZA_CARTELLA;
  const wt = WORKTREE.exec(c)?.[1];
  if (wt) return nomeProgetto(wt);
  const repo = c.startsWith("/") ? repoDelWorktree(c) : null;
  return nomeProgetto(repo ?? c);
}

/** Una prova automatica: lavora sotto le cartelle temporanee del sistema. Mai dal titolo: una sessione vera può chiamarsi «PROVA-…». Le chat senza cartella (scratch) sono vere e non contano mai. */
export function eProva(s: Pick<Sessione, "cartella" | "titolo">): boolean {
  if (scratch(s.cartella)) return false;
  return TEMPORANEE.some((t) => sotto(s.cartella, t));
}
