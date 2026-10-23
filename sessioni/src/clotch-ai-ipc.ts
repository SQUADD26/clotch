// Canali IPC di clotch AI (#352), nel processo main: comandi nella casella, registro e suoi aggiornamenti, avvio di clotch AI.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { IpcMain } from "electron";
import { cartellaRegistro, Comando, leggiRegistro, Registro } from "./clotch-ai";
import { inviaComando } from "./comandi";
import { daLeggere, leggi } from "./voce-app";

/** Il registro senza Map, per passare il ponte del preload. Nel renderer `daPiano` (ui/clotch-ai/registro.ts) rimette le Map. */
export const piano = (r: Registro) => JSON.parse(JSON.stringify(r, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v)));

export function collegaClotchAi(ipc: IpcMain, invia: (canale: string, dati: unknown) => void, home: string, env: NodeJS.ProcessEnv = process.env) {
  ipc.handle("clotch-ai:comando", (_e, cmd: Comando, args: Record<string, unknown>) => inviaComando(home, cmd, args ?? {}, { env }));
  ipc.handle("clotch-ai:registro", () => piano(leggiRegistro(home, env)));
  // Contratto: a clotch AI spenta la casella non serve; si avvia con `friday avvia` (launchctl kickstart). // nome del protocollo del motore
  ipc.handle("clotch-ai:avvia", () => new Promise((ok) =>
    execFile(path.join(home, ".claude", "bin", "friday"), ["avvia"], (err, out, errOut) => ok({ ok: !err, testo: String(err ? errOut || err.message : out).trim() })))); // nome del protocollo del motore

  // shortcut: rilegge tutto il registro a ogni cambio (al massimo ogni 300 ms); se il mese diventa grande, leggere solo la coda nuova.
  const dir = cartellaRegistro(home, env);
  let attesa: NodeJS.Timeout | null = null;
  let visti: Set<string> | null = null;
  const aggiorna = () => {
    const r = leggiRegistro(home, env);
    const v = daLeggere(r, visti);
    visti = v.visti;
    v.testi.forEach(leggi);
    invia("clotch-ai:registro", piano(r));
  };
  const cambiato = () => { attesa ??= setTimeout(() => { attesa = null; aggiorna(); }, 300); };
  const guarda = () => { try { fs.watch(dir, cambiato); } catch { setTimeout(guarda, 5000); } }; // cartella non ancora creata: riprova
  guarda();
  aggiorna(); // segna gli avvisi già scritti come visti
}
