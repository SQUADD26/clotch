// Preferenze dell'app per sessione (#360): icona, colore, fissa in alto, non letta; e impostazioni dell'app (#368).
// Un solo file `{ sessioni: { <id>: … }, app: { … } }`, scritto solo dal main. Le sessioni restano in sola lettura.
import * as fs from "node:fs";
import * as path from "node:path";
import type { PreferenzeSessione } from "./tipi";

export type Preferenze = Record<string, PreferenzeSessione>;
export type Impostazioni = Record<string, unknown>;
interface FilePreferenze { sessioni: Preferenze; app: Impostazioni }

const oggetto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** File mancante = niente. File rotto = errore: mai sovrascriverlo e perdere le scelte. */
function leggiFile(file: string): FilePreferenze {
  let testo: string;
  try { testo = fs.readFileSync(file, "utf8"); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { sessioni: {}, app: {} };
    throw e;
  }
  const p = JSON.parse(testo);
  if (!oggetto(p)) throw new Error(`preferenze non valide: ${file}`);
  if (!("sessioni" in p) && !("app" in p)) return { sessioni: p as Preferenze, app: {} }; // forma di #360: mappa piatta degli id
  if ((p.sessioni !== undefined && !oggetto(p.sessioni)) || (p.app !== undefined && !oggetto(p.app))) throw new Error(`preferenze non valide: ${file}`);
  return { sessioni: (p.sessioni ?? {}) as Preferenze, app: (p.app ?? {}) as Impostazioni };
}

/** Scrittura atomica (.tmp poi rename). */
function scriviFile(file: string, f: FilePreferenze) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(f, null, 2) + "\n");
  fs.renameSync(`${file}.tmp`, file);
}

const senzaNull = (o: Record<string, unknown>) => {
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined) delete o[k];
  return o;
};

export const leggiPreferenze = (file: string): Preferenze => leggiFile(file).sessioni;
export const leggiImpostazioni = (file: string): Impostazioni => leggiFile(file).app;

/** Unisce `parte` alle preferenze della sessione; un campo a null si toglie. */
export function impostaPreferenze(file: string, id: string, parte: { [K in keyof PreferenzeSessione]?: PreferenzeSessione[K] | null }): Preferenze {
  const f = leggiFile(file);
  const s = senzaNull({ ...f.sessioni[id], ...parte });
  if (Object.keys(s).length) f.sessioni[id] = s as PreferenzeSessione; else delete f.sessioni[id];
  scriviFile(file, f);
  return f.sessioni;
}

/** Unisce `parte` alle impostazioni dell'app; un campo a null si toglie. */
export function impostaImpostazioni(file: string, parte: Impostazioni): Impostazioni {
  if (!oggetto(parte)) throw new Error("impostazioni non valide");
  const f = leggiFile(file);
  f.app =senzaNull({ ...f.app, ...parte });
  scriviFile(file, f);
  return f.app;
}
