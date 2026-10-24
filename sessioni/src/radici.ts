// Radici degli account Claude: ~/.claude e ~/.claude-*. Identità = realpath (ConfigPathIdentity.swift).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { percorsiAccount } from "./account-percorsi";

export interface Radice {
  path: string;
  /** Nome della cartella: `.claude`, `.claude-roberto`. È l'identità dell'account. */
  account: string;
  email: string | null;
  /** `oauthAccount.accountUuid` di `.claude.json`: lega l'account alle sessioni dell'app Claude (cartella `claude-code-sessions/<uuid>/`, #996). */
  uuid?: string | null;
}

const identita = (p: string) => {
  try {
    return fs.realpathSync(p).normalize("NFC");
  } catch {
    return p.normalize("NFC");
  }
};

/** `.claude.json` per firma (mtime e misura): è grande e cambia di rado, ma l'elenco chiede l'email a ogni giro (#474). */
const email = new Map<string, { firma: string; email: string | null; uuid: string | null }>();
const accountDi = (radice: string): { email: string | null; uuid: string | null } => {
  const file = path.join(radice, ".claude.json");
  try {
    const st = fs.statSync(file), firma = `${st.ino}:${st.mtimeMs}:${st.size}`, e = email.get(file);
    if (e?.firma === firma) return { email: e.email, uuid: e.uuid };
    const o = JSON.parse(fs.readFileSync(file, "utf8"))?.oauthAccount, v = { email: o?.emailAddress ?? null, uuid: o?.accountUuid ?? null };
    email.set(file, { firma, ...v });
    return v;
  } catch {
    email.delete(file);
    return { email: null, uuid: null };
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
    out.push({ path: p, account: n, ...accountDi(p) });
  }
  return out;
}

/** `~/…` -> percorso assoluto, per aprire una cartella scritta come nel disegno. */
export const espandi = (p: string, home = os.homedir()) => (p === "~" || p.startsWith("~/") ? path.join(home, p.slice(1)) : p);

/** `/Users/x/.claude-y` -> `~/.claude-y`, come lo scrive il disegno. */
export const accorcia = (p: string, home = os.homedir()) => (p === home ? "~" : p.startsWith(home + path.sep) ? "~" + p.slice(home.length) : p);

/** Le radici da leggere davvero: `trovaRadici` più `accountAggiunti` meno `accountTolti` (percorsi scritti con `~`). */
export function radiciScelte(home: string, aggiunte: string[] = [], tolte: string[] = []): Radice[] {
  const trovate = trovaRadici(home);
  return percorsiAccount(trovate.map((r) => accorcia(r.path, home)), aggiunte, tolte).map((p) => {
    const assoluto = espandi(p, home);
    return trovate.find((r) => r.path === assoluto) ?? { path: assoluto, account: path.basename(assoluto), ...accountDi(assoluto) };
  });
}
