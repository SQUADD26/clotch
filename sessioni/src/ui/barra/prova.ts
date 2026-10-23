// figma: 101-7728 — dati della prova di parità (`npm run parita -- <frame>`): ogni frame della barra con i suoi testi e stati.
// Fuori dalla prova `prova()` torna null e la barra legge i dati veri.
import type { Registro } from "../../clotch-ai";
import type { Elenco, PreferenzeSessione, PrSessione, RisultatoRicerca, Sessione, Sorgente, Stato } from "../../tipi";
import type { Stato as StatoChiamata } from "../base/dati";
import type { Vista } from "./elenco";
import type { Aperto } from "./index";

const ORA = new Date(2026, 9, 22, 15, 0).getTime();
const MIN = 60_000;

let n = 0;
function s(titolo: string, progetto: string, stato: Stato, eta: number, sorgente: Sorgente = "claude-code", account = "accountmanager"): Sessione {
  return {
    id: `s${++n}`, sorgente, account, email: null, idApp: null, titolo, progetto, cartella: `/Users/privato/Documents/Repos/${progetto}`,
    ramo: null, modello: null, stato, perche: null, ultimaAttivita: ORA - eta * MIN, obiettivo: null, situazione: null, file: "",
  };
}
/** Sessioni vecchie per i conteggi delle cartelle chiuse; sei account su quattro sorgenti, come «6 account · 4 sorgenti». */
const ACCOUNT: [Sorgente, string][] = [["claude-code", "accountmanager"], ["claude-code", "squadd"], ["claude-desktop", "roberto"], ["claude-desktop", "squadd"], ["codex", "codex"], ["cursor", "cursor"]];
const riempi = (progetto: string, quante: number, eta: number) =>
  Array.from({ length: quante }, (_, i) => s(`${progetto} ${i + 1}`, progetto, "finita", eta + i, ...ACCOUNT[i % ACCOUNT.length]));

function clotch(icone: [string, string?][]) {
  const lista = [
    s("Clotch: sessioni in Electron", "clotch", "lavora", 1), s("Sessioni: lettura dal disco", "clotch", "lavora", 2),
    s("Notch: avviso schermo", "clotch", "finita", 3), s("Voce: parole inglesi", "clotch", "ferma", 4),
  ];
  const pref: Record<string, PreferenzeSessione> = {};
  lista.forEach((x, i) => { pref[x.id] = { icona: icone[i][0], ...(icone[i][1] ? { colore: icone[i][1] } : {}) }; });
  return { lista, pref };
}

function registro(f: { stato?: "attiva" | "spenta"; nd?: { fino: number | null; tenuti: number }; aspettano?: number; clotch?: boolean; afk?: number } = {}): Registro {
  const chat = new Map<string, any>([["friday", { chat: "friday", visto: f.stato === "spenta" ? ORA - 3600 * 1000 : ORA }]]); // nome del protocollo del motore
  for (let i = 0; i < (f.aspettano ?? 0); i++)
    chat.set(`c${i}`, { chat: `c${i}`, progetto: "clotch", visto: ORA, richieste: [{ genere: "permesso" }], stato: "serve_roberto", passi: [], aiutanti: new Map() });
  // «Con e senza Clotch» (#437): Clotch acceso da un minuto; `afk` = quanti avvisi tiene dopo 20 min via dal Mac
  const clotch = f.clotch ? { voce: "accesa", parla: false, ascolta: false, t: ORA - MIN } : null;
  const afk = f.afk === undefined ? null : { da: ORA - 20 * MIN, avvisi: f.afk };
  return { chat, clotchAi: { evento: "avvio", t: ORA }, nonDisturbare: f.nd ?? null, clotch, afk } as unknown as Registro;
}

interface Prova {
  ora: number;
  elenco: StatoChiamata<Elenco> & { riprova(): void };
  pref: Record<string, PreferenzeSessione>;
  registro: Registro | null;
  vista?: Vista;
  aperto?: Aperto;
  aperte?: string[];
  scelta?: string;
  /** Vista aperta (useNavigazione().vista) del frame; di solito «sessione». */
  pagina?: string;
  passaggio?: string;
  ricerca?: string;
  cercati?: RisultatoRicerca[];
  suggerimento?: { testo: string; a: { x: number; y: number } };
}

const pronto = (sessioni: Sessione[], errori: Elenco["errori"] = []) => ({ stato: "pronto" as const, dati: { sessioni, errori }, riprova() {} });
const ICONE: [string, string?][] = [["stella"], ["strati"], ["schermo"], ["microfono"]];

function base(icone = ICONE, extra: Partial<Prova> = {}): Prova {
  const c = clotch(icone);
  const sessioni = [...c.lista, ...riempi("squadd-v2", 23, 60), ...riempi("dentalspace", 9, 200), ...riempi("clotch-ai-mac-v2", 14, 400)];
  return { ora: ORA, elenco: pronto(sessioni), pref: c.pref, registro: registro(), scelta: c.lista[0].id, ...extra };
}

const FRAME: Record<string, () => Prova> = {
  "101-8036": () => base(),
  "101-8309": () => base(),
  "101-33775": () => base(),
  "101-34190": () => base(),
  "101-9628": () => base(),
  "101-35109": () => base(),
  "101-8805": () => ({ ora: ORA, elenco: pronto([]), pref: {}, registro: registro() }),
  "101-8912": () => ({ ora: ORA, elenco: { stato: "carica", riprova() {} }, pref: {}, registro: registro() }),
  "101-9090": () => { const b = base(); return { ...b, elenco: pronto(b.elenco.dati!.sessioni, [{ percorso: "~/.claude-clotch-ai", messaggio: "permesso negato" }]) }; },
  "101-12118": () => { const b = base([["stella", "arancione"], ...ICONE.slice(1)]); return { ...b, aperto: { tipo: "icona", id: b.scelta!, a: { x: 335, y: 169 } } }; },
  "101-21061": () => {
    const b = base();
    const ids = b.elenco.dati!.sessioni.map((x) => x.id);
    b.pref[ids[3]].fissa = true;
    return { ...b, passaggio: ids[1], aperto: { tipo: "riga", id: ids[1], a: { x: 282, y: 408 } } };
  },
  "101-21257": () => { const b = base(); return { ...b, aperto: { tipo: "cartella", chiave: "squadd-v2", a: { x: 286, y: 460 } } }; },
  "101-21376": () => ({ ...base(), aperto: { tipo: "profilo", a: { x: 72, y: 672 } } }),
  "101-24127": () => {
    const b = base();
    b.elenco.dati!.sessioni[0].titolo = "Clotch: sessioni in Electron con lettura dal disco e filtri";
    return { ...b, passaggio: b.scelta, suggerimento: { testo: b.elenco.dati!.sessioni[0].titolo, a: { x: 120, y: 326 } } };
  },
  "101-30238": () => ({ ...base(), aperto: { tipo: "raggruppa", a: { x: 326, y: 142 } } }),
  "101-38897": () => ({ ...base(), pagina: "clotch-ai", registro: registro({ nd: { fino: new Date(2026, 9, 22, 18, 0).getTime(), tenuti: 3 }, aspettano: 3 }) }),
  "101-42000": () => ({ ...base(), pagina: "clotch-ai", registro: registro({ stato: "spenta", aspettano: 3 }) }),
};

// sessioni figlie e PR (101:34605): madri e figlie con l'indicatore della loro PR
const pr = (numero: number, stato: PrSessione["stato"]): PrSessione => ({ numero, stato, verso: "dev", url: `https://github.com/SQUADD26/clotch/pull/${numero}` });
FRAME["101-34605"] = () => {
  const f = (x: Sessione, idApp: string, padre: string | null, p?: PrSessione): Sessione => ({ ...x, idApp,
    app: { padre, prs: p ? [p] : [], connettori: [], strumentiMcp: 0, cli: null, ospite: null, remoto: false } });
  const lista = [
    f(s("Sessioni: disegno e app Electron", "clotch", "lavora", 1), "local_1", null, pr(336, "aperta")),
    f(s("Figma: schermate app Sessioni", "clotch", "lavora", 2), "local_2", "local_1", pr(335, "aperta")),
    f(s("Sessioni: lettura dal disco", "clotch", "finita", 3), "local_3", "local_1", pr(334, "unita")),
    f(s("Notch: avviso schermo", "clotch", "finita", 4), "local_4", null, pr(319, "unita")),
    f(s("clotch AI: casella e sandbox", "squadd-v2", "lavora", 5), "local_5", null, pr(2412, "aperta")),
    f(s("Figma: lavagna sistema clotch AI", "squadd-v2", "aspetta", 6), "local_6", "local_5"),
    f(s("Backend: auth e RLS", "squadd-v2", "ferma", 7), "local_7", null, pr(2398, "chiusa")),
  ];
  const icone = ["stella", "tavolozza", "database", "schermo", "fulmine", "tavolozza", "database"];
  const pref = Object.fromEntries(lista.map((x, i) => [x.id, { icona: icone[i] }]));
  return { ora: ORA, elenco: pronto([...lista, ...riempi("dentalspace", 9, 200), ...riempi("clotch-ai-mac-v2", 14, 400)]), pref, registro: registro(), scelta: lista[0].id, aperte: ["squadd-v2"] };
};

// sessione aperta da clotch AI (101:45507): la barra ha solo la cartella della sessione
FRAME["101-45507"] = () => {
  const lista = [s("Backend: auth e RLS", "squadd-v2", "aspetta", 1), s("Squadd: promozione di dev", "squadd-v2", "aspetta", 2)];
  return { ora: ORA, elenco: pronto(lista), pref: { [lista[0].id]: { icona: "database" }, [lista[1].id]: { icona: "stella" } }, registro: registro({ aspettano: 3 }), scelta: lista[0].id };
};
// «Con e senza Clotch» (#437): la barra dei nove frame; 3 sessioni aspettano te, come la Casella del disegno
const CON = (pagina: string, f: Parameters<typeof registro>[0] = {}) => () => ({ ...base(), pagina, aperte: ["clotch"], registro: registro({ aspettano: 3, ...f }) });
for (const id of ["101-46268", "101-46701", "101-48368"]) FRAME[id] = CON("clotch-ai", { clotch: true });
for (const id of ["101-46308", "101-46741"]) FRAME[id] = CON("clotch-ai");
FRAME["101-49067"] = CON("casella", { clotch: true, afk: 4 });
FRAME["101-49194"] = CON("casella");
FRAME["101-49592"] = CON("sessione", { clotch: true });
FRAME["101-49632"] = CON("sessione");

function filtrata(aperto?: Aperto): Prova {
  const lista = [s("Backend: auth e RLS", "squadd-v2", "aspetta", 1), s("Squadd: promozione di dev", "squadd-v2", "aspetta", 2)];
  const altre = base().elenco.dati!.sessioni.filter((x) => x.stato !== "aspetta");
  return {
    ora: ORA, elenco: pronto([...lista, ...altre]), pref: { [lista[0].id]: { icona: "database" } }, registro: registro(), scelta: lista[0].id,
    vista: { filtri: [{ proprieta: "sorgente", valori: ["Claude Code"] }, { proprieta: "stato", valori: ["aspetta"] }], raggruppa: "cartella", ordina: "attivita" },
    aperto,
  };
}
FRAME["101-10017"] = () => filtrata({ tipo: "opzioni", i: 1, a: { x: 334, y: 250 } });
FRAME["101-16818"] = () => filtrata({ tipo: "proprieta", a: { x: 334, y: 250 } });

// 200 sessioni (101:9340): le dodici visibili di clotch con le loro icone, le altre cartelle chiuse
const TANTE: [string, string, Stato][] = [
  ["Notch: luce bianca ed errore", "lampadina", "finita"], ["Voce: Scribe e microfono", "microfono", "finita"],
  ["Clotch: impostazioni in stile Apple", "stella", "lavora"], ["AFK: foto dello schermo", "schermo", "ferma"],
  ["ADHD: domande aperte", "lampadina", "finita"], ["Hook: posizione di Codex", "codice", "finita"],
  ["Notch: bottoni sotto la barra", "strati", "finita"], ["Voce: pronuncia di Overseer", "microfono", "finita"],
  ["Release 2.4: note", "libro", "lavora"], ["Quote: uso degli account", "grafico", "ferma"],
  ["Cowork: lavagna 71", "tavolozza", "finita"], ["ESP32: stato via Bluetooth", "globo", "finita"],
];
FRAME["101-9340"] = () => {
  const lista = TANTE.map(([t, , st], i) => s(t, "clotch", st, i + 1));
  const pref = Object.fromEntries(lista.map((x, i) => [x.id, { icona: TANTE[i][1] }]));
  const sessioni = [...lista, ...riempi("squadd-v2", 71, 60), ...riempi("dentalspace", 38, 200), ...riempi("clotch-ai-mac-v2", 27, 400)];
  return { ora: ORA, elenco: pronto(sessioni), pref, registro: registro({ aspettano: 3 }), scelta: lista[3].id };
};

/** Ricerca: «Lettura dei log di Codex» nel titolo; tre sessioni trovate solo nei messaggi, coi frammenti di 101:10247. */
function ricerca(testo: string): Prova {
  const b = base();
  const extra = [
    s("Lettura dei log di Codex", "clotch-ai-mac-v2", "finita", 10 * 24 * 60, "codex", "codex"),
    s("Backend: auth e RLS", "squadd-v2", "finita", 24 * 60), s("Overseer: voce in Clotch", "clotch", "finita", 3 * 24 * 60),
  ];
  const nel = (x: Sessione, frammento: string): RisultatoRicerca => ({ id: x.id, titolo: x.titolo, frammento, t: x.ultimaAttivita, nelTitolo: false });
  return {
    ...b, elenco: pronto([...b.elenco.dati!.sessioni, ...extra]), ricerca: testo,
    pref: { ...b.pref, [extra[0].id]: { icona: "libro" }, [extra[1].id]: { icona: "database" }, [extra[2].id]: { icona: "scintille" } },
    cercati: testo === "lettura" ? [
      nel(b.elenco.dati!.sessioni[0], "…la lettura delle sessioni dal disco la fa un'altra sessione, nella cartella sessioni/…"),
      nel(extra[1], "…la policy blocca la lettura di «sessioni» se manca lo studio dell'utente…"),
      nel(extra[2], "…dopo la lettura ad alta voce la sessione torna in attesa…"),
    ] : [],
  };
}
FRAME["101-10297"] = () => ricerca("lettura");
FRAME["101-23003"] = () => ricerca("copia");
FRAME["101-23248"] = () => ricerca("kubernetes");
// allegati e immagini nel filo (#437): la barra di «Sessione aperta», come 101-8036
for (const id of ["101-25845", "101-27294", "101-28041", "101-28232"]) FRAME[id] = () => base();

// frame «Casella: …» (#437): la barra è quella di 101:8036
for (const id of ["101-26745", "101-27018", "101-26140", "101-26427", "101-27528"]) FRAME[id] = FRAME["101-8036"];

// i dialoghi (#437) stanno sopra la sessione aperta, con la barra di «Sessione aperta»
FRAME["101-22137"] = FRAME["101-8036"];
FRAME["101-22186"] = FRAME["101-8036"];

let una: Prova | null | undefined;
/** Calcolata una volta: gli id delle sessioni restano gli stessi a ogni disegno. */
export function prova(): Prova | null {
  if (una === undefined) {
    const id = new URLSearchParams(location.search).get("parita");
    una = id && FRAME[id] ? FRAME[id]() : null;
  }
  return una;
}
