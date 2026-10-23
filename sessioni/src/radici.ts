// Radici degli account Claude: ~/.claude e ~/.claude-*. Identità = realpath (ConfigPathIdentity.swift).
import * as fs from "node:fs";
import * as path from "node:path";

export interface Radice {
  path: string;
  /** Nome della cartella: `.claude`, `.claude-roberto`. È l'identità dell'account. */
  account: string;
  email: string | null;
}

const identita = (p: string) => {
  try {
    return fs.realpathSync(p).normalize("NFC");
  } catch {
    return p.normalize("NFC");
  }
};

const emailDi = (radice: string): string | null => {
  try {
    return JSON.parse(fs.readFileSync(path.join(radice, ".claude.json"), "utf8"))?.oauthAccount?.emailAddress ?? null;
  } catch {
    return null;
  }
};

/** Solo cartelle vere (con `projects/` o `settings.json`); due nomi che portano allo stesso posto contano una volta. */
export function trovaRadici(home: string): Radice[] {
  let nomi: string[] = [];
  try {
    nomi = fs.readdirSync(home);
  } catch {
    return [];
  }
  const candidati = nomi.filter((n) => n === ".claude" || n.startsWith(".claude-")).sort((a, b) => (a === ".claude" ? -1 : b === ".claude" ? 1 : a.localeCompare(b)));
  const viste = new Set<string>();
  const out: Radice[] = [];
  for (const n of candidati) {
    const p = path.join(home, n);
    try {
      if (!fs.statSync(p).isDirectory()) continue;
    } catch {
      continue;
    }
    if (!fs.existsSync(path.join(p, "projects")) && !fs.existsSync(path.join(p, "settings.json"))) continue;
    const id = identita(p);
    if (viste.has(id)) continue;
    viste.add(id);
    out.push({ path: p, account: n, email: emailDi(p) });
  }
  return out;
}
