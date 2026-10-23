import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const FIXTURES = path.join(__dirname, "..", "..", "test", "fixtures", "home");

/** Copia le fixture in una cartella temporanea: i test possono scriverci senza toccare il repo. */
export function copiaHome(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sessioni-"));
  fs.cpSync(FIXTURES, d, { recursive: true });
  return d;
}

/** Percorso -> "dimensione:mtime" di tutto l'albero, per provare che nulla è stato toccato. */
export function istantanea(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visita = (d: string) => {
    for (const v of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, v.name);
      if (v.isDirectory()) visita(p);
      else { const s = fs.statSync(p); out[p] = `${s.size}:${s.mtimeMs}`; }
    }
  };
  visita(dir);
  return out;
}
