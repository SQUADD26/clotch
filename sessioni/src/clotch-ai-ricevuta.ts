// Contratto locale di claude-config/friday_fiducia.py: il client legge le ricevute, non le crea. // nome del protocollo del motore
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

/** json.dumps(sort_keys=True, ensure_ascii=False), sul dominio delle decisioni (v/n interi, dati stringhe/argv). */
export function canonico(v: unknown): string {
  if (v === null || typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" && Number.isSafeInteger(v) && !Object.is(v, -0)) return String(v);
  if (Array.isArray(v)) return `[${v.map(canonico).join(", ")}]`;
  if (typeof v !== "object" || !v) throw new TypeError("tipo fuori contratto");
  const ordine = (a: string, b: string) => {
    const x = Array.from(a, c => c.codePointAt(0)!), y = Array.from(b, c => c.codePointAt(0)!);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  };
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort(ordine).map(k => `${JSON.stringify(k)}: ${canonico(o[k])}`).join(", ")}}`;
}

/** Assenza, importazione o modifica dell'evento: nessun annullo offerto. Stesso digest dell'intero evento del backend. */
export function ricevutaLocale(o: Record<string, unknown>, home: string, env: NodeJS.ProcessEnv): boolean {
  const remota = o.origine_remota;
  const vuota = remota === null || remota === undefined || remota === false || remota === 0 || remota === "" ||
    (Array.isArray(remota) ? remota.length === 0 : typeof remota === "object" && Object.keys(remota).length === 0);
  if (o.tipo !== "decisione" || o.chat !== "friday" || !vuota || typeof o.id !== "string" || !/^r-[0-9a-f]{12}$/.test(o.id)) return false; // nome del protocollo del motore
  try {
    const file = path.join(env.FRIDAY_DIR || path.join(home, ".claude", "friday"), "eventi-locali", "decisione", o.id); // nome del protocollo del motore
    return fs.readFileSync(file, "utf8") === createHash("sha256").update(canonico(o), "utf8").digest("hex");
  } catch { return false; }
}
