// Preferenze dell'app per sessione (#360): icona, colore, fissa in alto, non letta. Un solo file, scritto solo dal main.
// È l'unica scrittura dell'app oltre ai comandi a Friday: le sessioni restano in sola lettura.
import * as fs from "node:fs";
import * as path from "node:path";
import type { PreferenzeSessione } from "./tipi";

export type Preferenze = Record<string, PreferenzeSessione>;

/** File mancante = nessuna preferenza. File rotto = errore: mai sovrascriverlo e perdere le scelte. */
export function leggiPreferenze(file: string): Preferenze {
  let testo: string;
  try { testo = fs.readFileSync(file, "utf8"); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
  const p = JSON.parse(testo);
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error(`preferenze non valide: ${file}`);
  return p;
}

/** Unisce `parte` alle preferenze della sessione; un campo a null si toglie. Scrittura atomica (.tmp poi rename). */
export function impostaPreferenze(file: string, id: string, parte: { [K in keyof PreferenzeSessione]?: PreferenzeSessione[K] | null }): Preferenze {
  const tutte = leggiPreferenze(file);
  const s: Record<string, unknown> = { ...tutte[id], ...parte };
  for (const k of Object.keys(s)) if (s[k] === null || s[k] === undefined) delete s[k];
  if (Object.keys(s).length) tutte[id] = s as PreferenzeSessione; else delete tutte[id];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(tutte, null, 2) + "\n");
  fs.renameSync(`${file}.tmp`, file);
  return tutte;
}
