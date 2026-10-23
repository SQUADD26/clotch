// Canali IPC di Friday (#352), nel processo main: comandi nella casella, registro e suoi aggiornamenti, avvio di Friday.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { IpcMain } from "electron";
import { cartellaRegistro, Comando, leggiRegistro, Registro } from "./friday";
import { inviaComando } from "./comandi";
import { daLeggere, leggi, staParlando, suVoceApp } from "./voce-app";
import { cartelleStatoApp, leggiStatoApp } from "./stato-app";
import { eComandoApp, eseguiComandoApp, type ComandoApp } from "./comandi-app";

/** Il registro senza Map, per passare il ponte del preload. Nel renderer `daPiano` (ui/friday/registro.ts) rimette le Map. */
export const piano = (r: Registro) => JSON.parse(JSON.stringify(r, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v)));

/** Il registro più quello che l'app sa da Clotch fuori dal registro: schermo occupato, AFK, voce dell'app (`Registro` di friday.ts). */
const completo = (r: Registro, home: string, env: NodeJS.ProcessEnv) => ({ ...piano(r), ...leggiStatoApp(home, Date.now(), env), voceApp: staParlando() });

export function collegaFriday(ipc: IpcMain, invia: (canale: string, dati: unknown) => void, home: string, env: NodeJS.ProcessEnv = process.env) {
  ipc.handle("friday:comando", (_e, cmd: Comando | ComandoApp, args: Record<string, unknown>) =>
    eComandoApp(cmd) ? eseguiComandoApp(cmd) : inviaComando(home, cmd, args ?? {}, { env }));
  ipc.handle("friday:registro", () => completo(leggiRegistro(home, env), home, env));
  // Contratto: a Friday spenta la casella non serve; si avvia con `friday avvia` (launchctl kickstart).
  ipc.handle("friday:avvia", () => new Promise((ok) =>
    execFile(path.join(home, ".claude", "bin", "friday"), ["avvia"], (err, out, errOut) => ok({ ok: !err, testo: String(err ? errOut || err.message : out).trim() }))));

  // shortcut: rilegge tutto il registro a ogni cambio (al massimo ogni 300 ms); se il mese diventa grande, leggere solo la coda nuova.
  const dir = cartellaRegistro(home, env);
  let attesa: NodeJS.Timeout | null = null;
  let visti: Set<string> | null = null;
  const aggiorna = () => {
    const r = leggiRegistro(home, env);
    const v = daLeggere(r, visti);
    visti = v.visti;
    v.testi.forEach(leggi);
    invia("friday:registro", completo(r, home, env));
  };
  const cambiato = () => { attesa ??= setTimeout(() => { attesa = null; aggiorna(); }, 300); };
  const guarda = () => { try { fs.watch(dir, cambiato); } catch { setTimeout(guarda, 5000); } }; // cartella non ancora creata: riprova
  guarda();
  // schermo occupato e AFK stanno in altre cartelle; la voce dell'app cambia quando `say` parte o finisce
  for (const d of cartelleStatoApp(home, env)) { try { fs.watch(d, cambiato); } catch { /* cartella assente: lo stato resta null */ } }
  suVoceApp(cambiato);
  aggiorna(); // segna gli avvisi già scritti come visti
}
