// Allegati, immagini e skill della casella (#437), senza Electron: i canali stanno in allegati-ipc.ts.
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { limiteAllegato } from "./allegati-limiti";
import { immaginiDiRiga } from "./messaggi-claude";
import type { DaImmagine, FileAllegato, RifImmagine, SkillNome } from "./tipi";

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", heic: "image/heic", tif: "image/tiff", tiff: "image/tiff",
};
const estensione = (p: string) => path.extname(p).slice(1).toLowerCase();
/** Un'immagine su disco più grande di così non si porta nel renderer. */
const MAX_IMMAGINE = 25 * 1024 * 1024;

const assoluto = (p: unknown): p is string => typeof p === "string" && path.isAbsolute(p);

/** Nome, tipo e peso di ogni percorso; uno che non si legge si salta. */
export function descrivi(percorsi: unknown): FileAllegato[] {
  if (!Array.isArray(percorsi)) return [];
  return percorsi.filter(assoluto).flatMap((percorso): FileAllegato[] => {
    try {
      const st = fs.statSync(percorso);
      const tipo = st.isDirectory() ? "cartella" : estensione(percorso) in MIME ? "immagine" : "file";
      return [{ percorso, nome: path.basename(percorso), tipo, byte: st.isDirectory() ? null : st.size }];
    } catch { return []; }
  });
}

/** La riga della trascrizione col suo `uuid`; legge a flusso, un file di molti MB non si carica intero. */
async function rigaDi(file: string, uuid: string): Promise<any | null> {
  const flusso = fs.createReadStream(file, { encoding: "utf8" });
  const righe = readline.createInterface({ input: flusso, crlfDelay: Infinity });
  try {
    for await (const r of righe) {
      if (!r.includes(`"uuid":"${uuid}"`)) continue;
      try { const o = JSON.parse(r); if (o.uuid === uuid) return o; } catch { /* riga rotta: si cerca ancora */ }
    }
  } finally { righe.close(); flusso.destroy(); }
  return null;
}

export interface ImmagineLetta { mime: string; base64: string }

/** I byte di un'immagine: dalla riga della trascrizione (con `rif`) o da un file su disco. null se non si legge. */
export async function leggiImmagine(da: DaImmagine | undefined, fileSessione: (id: string) => string | null): Promise<ImmagineLetta | null> {
  try {
    if (da && "percorso" in da) {
      const mime = MIME[estensione(String(da.percorso))];
      if (!mime || !assoluto(da.percorso) || fs.statSync(da.percorso).size > MAX_IMMAGINE) return null;
      return { mime, base64: (await fs.promises.readFile(da.percorso)).toString("base64") }; // a pezzi: un file grande non ferma il main (#474)
    }
    const rif: RifImmagine | undefined = da?.rif;
    const file = da && typeof da.sessione === "string" ? fileSessione(da.sessione) : null;
    if (!file || !rif || !/^[\w-]{8,64}$/.test(String(rif.riga)) || !Number.isInteger(rif.n)) return null;
    const riga = await rigaDi(file, rif.riga);
    const img = riga && immaginiDiRiga(riga.message?.content)[rif.n];
    return img ? { mime: img.mime, base64: img.data } : null;
  } catch { return null; }
}

export const comeIndirizzo = (i: ImmagineLetta) => `data:${i.mime};base64,${i.base64}`;

/** Le skill di un account (`~/<account>/skills/<nome>/SKILL.md`); senza quella cartella, quelle di `~/.claude`. */
export function leggiSkill(home: string, account: string): SkillNome[] {
  const proprio = typeof account === "string" && /^\.claude[\w.-]*$/.test(account) ? path.join(home, account, "skills") : null;
  const dir = [proprio, path.join(home, ".claude", "skills")].find((d) => { try { return !!d && fs.statSync(d).isDirectory(); } catch { return false; } });
  if (!dir) return [];
  return fs.readdirSync(dir).filter((n) => !n.startsWith(".") && fs.existsSync(path.join(dir, n, "SKILL.md"))).sort().map((nome) => ({ nome }));
}

const ESTENSIONE_MIME = Object.fromEntries(Object.entries(MIME).map(([e, m]) => [m, e]));
const MAX_INCOLLATA = 100 * 1024 * 1024;

/** Il motore accetta solo file regolari dentro `~/.claude/casella/allegati/` (sottocartelle ok): l'app copia lì ogni file scelto o incollato prima di `manda`. */
const salva = (home: string, nome: string, scrivi: (dest: string) => void) => {
  const dir = path.join(home, ".claude", "casella", "allegati", randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, nome);
  scrivi(dest);
  return dest;
};

/** Un'immagine incollata non ha un percorso: si salva in `allegati/<id>/immagine.<ext>` e si descrive. null se non è un'immagine, è vuota o troppo grande. */
export function salvaIncollata(home: string, mime: unknown, byte: unknown): FileAllegato | null {
  const ext = typeof mime === "string" ? ESTENSIONE_MIME[mime] : undefined;
  if (!ext || !(byte instanceof Uint8Array) || !byte.length || byte.length > MAX_INCOLLATA) return null;
  return descrivi([salva(home, `immagine.${ext}`, (d) => fs.writeFileSync(d, byte))])[0] ?? null;
}

/** Copia i file scelti o trascinati in `allegati/<id>/<nome>` e li descrive col nome di prima. Una cartella non si allega (il motore vuole file regolari);
 *  un file oltre il limite del suo tipo non si copia: resta col suo percorso e la casella dice «troppo grande». Un file che non si copia sparisce dal risultato. */
export function copiaAllegati(home: string, percorsi: unknown): FileAllegato[] {
  return descrivi(percorsi).flatMap((a): FileAllegato[] => {
    if (a.tipo === "cartella") return [];
    if (a.byte !== null && a.byte > limiteAllegato(a.nome)) return [a];
    try { return [{ ...a, percorso: salva(home, a.nome, (d) => fs.copyFileSync(a.percorso, d)) }]; } catch { return []; }
  });
}
