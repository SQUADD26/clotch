// Allegati, immagini e skill della casella (#437), senza Electron: i canali stanno in allegati-ipc.ts.
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
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
