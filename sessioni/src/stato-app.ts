// Cosa Clotch scrive fuori dal registro di clotch AI e l'app legge (solo lettura): schermo occupato da uno script (eventi.jsonl,
// contratto motore claude-config#2278) e «sei via dal Mac» (afk.json e afk-fatto.jsonl, modalità AFK di Clotch #106).
import * as fs from "node:fs";
import * as path from "node:path";

/** Come in ClotchCore/ScreenNotice.swift: uno script che non scrive `schermo_libero` smette di contare dopo 60 s. */
export const SCHERMO_SCADUTO_MS = 60_000;
const CODA_BYTE = 65_536;

export interface StatoApp {
  /** Da quando uno script usa lo schermo (ms); null = schermo libero. */
  schermo: { da: number } | null;
  /** AFK acceso: da quando (ms) e quante cose Clotch ha registrato nel frattempo. */
  afk: { da: number; avvisi: number } | null;
}

/** Ogni script (`da`) conta per la sua ultima riga; occupato = almeno uno con `schermo_in_arrivo` più giovane di 60 s. */
export function schermoOccupato(righe: string, ora: number): StatoApp["schermo"] {
  const ultime = new Map<string, { t: number; occupato: boolean }>();
  for (const riga of righe.split("\n")) {
    let o: any;
    try { o = JSON.parse(riga); } catch { continue; } // la prima riga della coda può essere tagliata
    if (!o || (o.tipo !== "schermo_in_arrivo" && o.tipo !== "schermo_libero") || !Number.isFinite(o.t)) continue;
    ultime.set(String(o.da ?? ""), { t: o.t, occupato: o.tipo === "schermo_in_arrivo" });
  }
  const vivi = [...ultime.values()].filter((x) => x.occupato && x.t <= ora && ora - x.t < SCHERMO_SCADUTO_MS);
  return vivi.length ? { da: Math.min(...vivi.map((x) => x.t)) } : null;
}

function coda(file: string): string {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, "r");
    const { size } = fs.fstatSync(fd);
    const inizio = Math.max(0, size - CODA_BYTE), buf = Buffer.alloc(size - inizio);
    fs.readSync(fd, buf, 0, buf.length, inizio);
    return buf.toString("utf8");
  } catch { return ""; } finally { if (fd !== null) fs.closeSync(fd); }
}

/** `afk.json` = `{"attivo", "inizio"}` in secondi; `afk-fatto.jsonl` = una riga per cosa fatta, con `t` in secondi. */
export function afkAcceso(home: string, env: NodeJS.ProcessEnv = {}): StatoApp["afk"] {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(home, ".config", "voce", "afk.json"), "utf8"));
    if (s?.attivo !== true || !Number.isFinite(s.inizio)) return null;
    let avvisi = 0;
    for (const riga of coda(path.join(cartellaClotch(home, env), "afk-fatto.jsonl")).split("\n")) {
      try { if (JSON.parse(riga).t >= s.inizio) avvisi++; } catch { /* riga rotta: saltata */ }
    }
    return { da: s.inizio * 1000, avvisi };
  } catch { return null; } // file assente o rotto = non via
}

const cartellaClotch = (home: string, env: NodeJS.ProcessEnv) => env.CLOTCH_DIR || path.join(home, ".config", "clotch");

/** Le cartelle da guardare: un cambio lì può cambiare lo stato. */
export const cartelleStatoApp = (home: string, env: NodeJS.ProcessEnv = {}) => [path.join(home, ".config", "voce"), cartellaClotch(home, env)];

export function leggiStatoApp(home: string, ora = Date.now(), env: NodeJS.ProcessEnv = {}): StatoApp {
  return { schermo: schermoOccupato(coda(path.join(home, ".config", "voce", "eventi.jsonl")), ora), afk: afkAcceso(home, env) };
}
