// Canali IPC di clotch AI (#352), nel processo main: comandi nella casella, registro e suoi aggiornamenti, avvio di clotch AI.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { IpcMain } from "electron";
import { cartellaRegistro, Comando, lettoreRegistro, Registro } from "./clotch-ai";
import { inviaComando } from "./comandi";
import { daLeggere, leggi, staParlando, suVoce } from "./voce-app";
import { avviaDettatura, fermaDettatura } from "./dettatura-app";
import { cartelleStatoApp, leggiStatoApp } from "./stato-app";
import { eComandoApp, eseguiComandoApp, type ComandoApp } from "./comandi-app";

/** Il registro senza Map, per passare il ponte del preload. Nel renderer `daPiano` (ui/clotch-ai/registro.ts) rimette le Map. */
export const piano = (r: Registro) => JSON.parse(JSON.stringify(r, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v)));

/** Il registro più quello che l'app sa da Clotch fuori dal registro: schermo occupato, AFK, voce dell'app (`Registro` di clotch-ai.ts). */
const completo = (r: Registro, home: string, env: NodeJS.ProcessEnv) => ({ ...piano(r), ...leggiStatoApp(home, Date.now(), env), voceApp: staParlando() });

export function collegaClotchAi(ipc: IpcMain, invia: (canale: string, dati: unknown) => void, home: string, env: NodeJS.ProcessEnv = process.env) {
  ipc.handle("clotch-ai:comando", (_e, cmd: Comando | ComandoApp, args: Record<string, unknown>) =>
    eComandoApp(cmd) ? eseguiComandoApp(cmd, args ?? {}) : inviaComando(home, cmd, args ?? {}, { env, ...(cmd === "nuova_sessione" ? { scadenzaMs: 90_000 } : cmd === "macchina_aggiungi" ? { scadenzaMs: 240_000 } : {}) })); // nuova_sessione: pochi secondi, fino a ~1 minuto se sceglie l'account; macchina_aggiungi: fino a ~3 minuti (installer)
  const leggiRegistro = lettoreRegistro(home, env); // un lettore solo: ogni lettura applica solo le righe nuove
  ipc.handle("clotch-ai:registro", () => completo(leggiRegistro(), home, env));
  // Voce dell'app (Clotch assente): lo stato «sta parlando» e «Interrompi» del frame 101-37055.
  ipc.handle("clotch-ai:voce", () => staParlando());
  suVoce((parla) => invia("clotch-ai:voce", parla));
  // Dettatura dell'app (Clotch spento): la pagina chiede solo «avvia»/«ferma», il microfono lo apre l'eseguibile nativo.
  ipc.handle("clotch-ai:dettatura", (_e, avvia: unknown) => avvia === true ? avviaDettatura((e) => invia("clotch-ai:dettatura", e)) : fermaDettatura());
  // Contratto: a clotch AI spenta la casella non serve; si avvia con `friday avvia` (launchctl kickstart). // nome del protocollo del motore
  ipc.handle("clotch-ai:avvia", () => new Promise((ok) =>
    execFile(path.join(home, ".claude", "bin", "friday"), ["avvia"], (err, out, errOut) => ok({ ok: !err, testo: String(err ? errOut || err.message : out).trim() })))); // nome del protocollo del motore

  const dir = cartellaRegistro(home, env);
  let attesa: NodeJS.Timeout | null = null;
  let visti: Set<string> | null = null;
  // l'ultimo inviato, per campo e per chat: a ogni cambio partono solo i pezzi diversi (#474: il registro intero è ~440 KB e la voce scrive ogni secondo)
  const ultimi = new Map<string, string>(), ultimeChat = new Map<string, string>();
  const parziale = (dati: Record<string, any>) => {
    const campi: Record<string, unknown> = {}, chat: Record<string, unknown> = {}, tolte: string[] = [];
    for (const [k, v] of Object.entries(dati)) {
      if (k === "chat") continue;
      const j = JSON.stringify(v);
      if (ultimi.get(k) !== j) { campi[k] = v; ultimi.set(k, j); }
    }
    for (const [id, c] of Object.entries(dati.chat ?? {})) {
      const j = JSON.stringify(c);
      if (ultimeChat.get(id) !== j) { chat[id] = c; ultimeChat.set(id, j); }
    }
    for (const id of ultimeChat.keys()) if (!(id in (dati.chat ?? {}))) { tolte.push(id); ultimeChat.delete(id); }
    return Object.keys(campi).length || Object.keys(chat).length || tolte.length ? { parziale: true, campi, chat, tolte } : null;
  };
  const aggiorna = () => {
    const r = leggiRegistro();
    const v = daLeggere(r, visti);
    visti = v.visti;
    v.testi.forEach(leggi);
    const p = parziale(completo(r, home, env));
    if (p) invia("clotch-ai:registro", p); // .lock e contatori.json svegliano il watcher senza cambiare il registro: niente

  };
  const cambiato = () => { attesa ??= setTimeout(() => { attesa = null; aggiorna(); }, 300); };
  const guarda = () => { try { fs.watch(dir, cambiato); } catch { setTimeout(guarda, 5000); } }; // cartella non ancora creata: riprova
  guarda();
  // schermo occupato e AFK stanno in altre cartelle; la voce dell'app cambia quando `say` parte o finisce
  for (const d of cartelleStatoApp(home, env)) { try { fs.watch(d, cambiato); } catch { /* cartella assente: lo stato resta null */ } }
  suVoce(cambiato);
  aggiorna(); // segna gli avvisi già scritti come visti
}
