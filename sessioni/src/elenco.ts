// Mette insieme le sorgenti in un solo elenco di sessioni.
import * as path from "node:path";
import { leggiRadice, nomeProgetto } from "./claude-code";
import { leggiApp, SessioneApp } from "./desktop";
import { leggiCodex, leggiCursor } from "./altre-sorgenti";
import { conPartenza, filtraElenco } from "./filtro-elenco";
import { radiciScelte } from "./radici";
import { leggiObiettivi, leggiStati, StatoRegistro } from "./registri";
import { Elenco, ErroreLettura, Obiettivo, Sessione, Stato } from "./tipi";

const ATTIVA_MS = 180_000; // come Clotch: senza segni di vita da 180 s una sessione non lavora più

export function statoDi(s: Sessione, reg: StatoRegistro | undefined, app: SessioneApp | undefined, ob: Obiettivo | null, ora: number): { stato: Stato; perche: string | null } {
  if (ob?.valido && (ob.stato === "raggiunto" || ob.stato === "passato")) return { stato: "finita", perche: null };
  if (reg) return { stato: reg.stato, perche: reg.perche };
  if (app?.archiviata && !app.inCorso) return { stato: "finita", perche: null };
  if (app?.inCorso || ora - s.ultimaAttivita <= ATTIVA_MS) return { stato: "lavora", perche: null };
  return { stato: "ferma", perche: null };
}

/** `impostazioni` (le salvate, sezione `app` del file delle preferenze): senza, tutto; con, solo quello che permettono (#404). */
export function leggiElenco(opz: { home: string; env?: NodeJS.ProcessEnv; ora?: number; impostazioni?: Record<string, unknown> }): Elenco {
  const errori: ErroreLettura[] = [];
  const ora = opz.ora ?? Date.now();
  const imp = opz.impostazioni && conPartenza(opz.impostazioni);
  const app = leggiApp(opz.home, errori);
  const perCli = new Map(app.map((a) => [a.cliId, a]));
  const obiettivi = leggiObiettivi(path.join(opz.home, ".claude"), errori);
  const stati = leggiStati(path.join(opz.home, ".claude"), errori);
  const statoPerLocale = new Map([...stati.values()].filter((r) => r.localId).map((r) => [r.localId!, r]));

  const tutte: Sessione[] = [];
  for (const r of radiciScelte(opz.home, imp?.accountAggiunti, imp?.accountTolti)) tutte.push(...leggiRadice(r, errori));
  const viste = new Set(tutte.map((s) => s.id));
  for (const s of tutte) {
    const a = perCli.get(s.id);
    if (!a) continue;
    s.sorgente = "claude-desktop";
    s.idApp = a.idApp;
    s.titolo = a.titolo || s.titolo;
    s.cartella = a.cartella ?? s.cartella;
    s.progetto = nomeProgetto(s.cartella);
    s.ramo = a.ramo ?? s.ramo;
    s.modello = a.modello ?? s.modello;
    s.ultimaAttivita = Math.max(s.ultimaAttivita, a.ultimaAttivita ?? 0);
  }
  // sessioni dell'app senza trascrizione sul disco: compaiono lo stesso, senza messaggi
  for (const a of app) {
    if (viste.has(a.cliId)) continue;
    const cartella = a.cartella ?? "";
    tutte.push({
      id: a.cliId, sorgente: "claude-desktop", account: a.profilo, email: null, idApp: a.idApp, titolo: a.titolo,
      progetto: nomeProgetto(cartella), cartella, ramo: a.ramo, modello: a.modello, stato: "ferma", perche: null,
      ultimaAttivita: a.ultimaAttivita ?? 0, obiettivo: null, situazione: null, file: a.file,
    });
  }
  if (!imp || imp.sorgenteCodex) tutte.push(...leggiCodex(opz.home, opz.env ?? process.env, errori));
  if (!imp || imp.sorgenteCursor) tutte.push(...leggiCursor(opz.home, errori));

  for (const s of tutte) {
    s.obiettivo = obiettivi.get(s.id) ?? null;
    const reg = stati.get(s.id) ?? (s.idApp ? statoPerLocale.get(s.idApp) : undefined);
    if (reg?.visto) s.ultimaAttivita = Math.max(s.ultimaAttivita, reg.visto);
    Object.assign(s, statoDi(s, reg, perCli.get(s.id), s.obiettivo, ora));
  }
  // lo stesso id in due radici: resta la più recente
  const unici = new Map<string, Sessione>();
  for (const s of tutte) {
    const k = `${s.sorgente === "claude-desktop" ? "claude-code" : s.sorgente}:${s.id}`;
    const p = unici.get(k);
    if (!p || p.ultimaAttivita < s.ultimaAttivita) unici.set(k, s);
  }
  const elenco = { sessioni: [...unici.values()].sort((a, b) => b.ultimaAttivita - a.ultimaAttivita), errori };
  return opz.impostazioni ? filtraElenco(elenco, opz.impostazioni, ora, opz.home) : elenco;
}
