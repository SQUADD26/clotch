// Lettura a blocchi di file JSONL. Solo `open` in sola lettura: niente scritture, niente lock.
import * as fs from "node:fs";

export function parseRiga(riga: string): any | null {
  const t = riga.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null; // riga rotta o tagliata: si salta la riga, non la sessione
  }
}

/** Legge i byte [da, a) del file come testo. */
export const leggiBlocco = (file: string, da: number, a: number): string => leggiBytes(file, da, a).toString("utf8");

export function leggiBytes(file: string, da: number, a: number): Buffer {
  if (a <= da) return Buffer.alloc(0);
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(a - da);
    const n = fs.readSync(fd, buf, 0, buf.length, da);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

/** Righe complete in [da, a). Se `da` non è 0 la prima riga può essere tagliata: la scarta. */
export function righeIn(file: string, da: number, a: number): string[] {
  const righe = leggiBlocco(file, da, a).split("\n");
  if (da > 0) righe.shift();
  return righe;
}

/** Righe nuove da `offset` in poi, solo quelle chiuse da `\n`. Una riga ancora a metà resta per il giro dopo. */
export function righeNuove(file: string, offset: number): { righe: string[]; offset: number } {
  const size = fs.statSync(file).size;
  if (size < offset) offset = 0; // file ricreato o accorciato: si riparte
  if (size === offset) return { righe: [], offset };
  const testo = leggiBlocco(file, offset, size);
  const fine = testo.lastIndexOf("\n");
  if (fine < 0) return { righe: [], offset };
  const chiuso = testo.slice(0, fine);
  return { righe: chiuso.split("\n"), offset: offset + Buffer.byteLength(chiuso, "utf8") + 1 };
}

/** Oggetti JSON validi nella testa e nella coda del file, senza leggerlo intero. */
export function testaECoda(file: string, size: number, testa = 64 * 1024, coda = 256 * 1024) {
  const t = righeIn(file, 0, Math.min(size, testa)).map(parseRiga).filter(Boolean);
  if (size <= testa) return { testa: t, coda: t };
  const c = righeIn(file, Math.max(0, size - coda), size).map(parseRiga).filter(Boolean);
  return { testa: t, coda: c };
}

/** File che passano `filtro` sotto `dir`, a qualsiasi profondità. Cartella mancante: lista vuota; illeggibile: errore in `errori`. */
export function trovaFile(dir: string, filtro: (nome: string) => boolean, errori: { percorso: string; messaggio: string }[]): string[] {
  const out: string[] = [];
  const visita = (d: string) => {
    let voci: fs.Dirent[];
    try {
      voci = fs.readdirSync(d, { withFileTypes: true });
    } catch (e: any) {
      if (e.code !== "ENOENT") errori.push({ percorso: d, messaggio: msgErrore(e) });
      return;
    }
    for (const v of voci) {
      const p = `${d}/${v.name}`;
      if (v.isDirectory()) visita(p);
      else if (filtro(v.name)) out.push(p);
    }
  };
  visita(dir);
  return out;
}

/** Messaggio d'errore breve e chiaro per un errore di lettura del disco. */
export const msgErrore = (e: any): string =>
  e?.code === "EACCES" || e?.code === "EPERM" ? "permesso negato" : e?.code === "ENOENT" ? "file sparito" : String(e?.message ?? e);
