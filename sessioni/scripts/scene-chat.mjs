// Scene di prova della chat (#349): `node scripts/scene-chat.mjs` scrive design/scene/101-<id>.json per i frame della chat,
// coi testi dei frame Figma. I tempi sono relativi ad adesso («da 2 min», «Nessun segnale da 6 min»): si rifà prima di `npm run parita`.
import { writeFileSync } from "node:fs";

const ORA = Date.now(), MIN = 60_000;
const OBIETTIVO = { testo: "L’app Sessioni in Electron, pari al disegno, con tutti gli stati.", stato: "aperto", valido: true,
  prove: [{ testo: "Test del lettore: 11 su 11", fatta: true }, { testo: "6 cartelle di account trovate", fatta: true }, { testo: "Revisione della PR", fatta: false }] };

const sessione = (x) => ({
  id: "s1", sorgente: "claude-code", account: ".claude-accountmanager", email: null, idApp: null, titolo: "Sessioni: app Electron",
  progetto: "clotch", cartella: "", ramo: "feat/333-sessioni-lettura", modello: "claude-opus-5-5", stato: "lavora", perche: null,
  ultimaAttivita: ORA - 2 * MIN, obiettivo: OBIETTIVO, situazione: { adesso: "lavora", strumento: null, inCoda: 0, segni: [] }, file: "", ...x,
});

// passi: [tipo, ..., secondi fino al passo dopo]; l'ultimo finisce `fine` ms fa
function messaggi(passi, fine = 2 * MIN) {
  const tot = passi.reduce((s, p) => s + p.at(-1), 0);
  let t = ORA - fine - tot * 1000, n = 0;
  return passi.map((p) => {
    const m = { ...p[0], t };
    if (m.tipo === "strumento") m.id = `t${n++}`;
    t += p.at(-1) * 1000;
    return m;
  });
}
const u = (testo, s = 1) => [{ tipo: "utente", testo }, s];
const a = (testo, s = 1) => [{ tipo: "assistente", testo, modello: "claude-opus-5-5" }, s];
const p = (s) => [{ tipo: "pensiero", testo: "Roberto vuole l’aspetto di ChatGPT. Prima leggo i token e le schermate del vault, poi creo le variabili e i componenti." }, s];
const st = (nome, ingresso, esito, s, errore = false) => [{ tipo: "strumento", nome, ingresso, esito: esito == null ? null : { testo: esito, errore } }, s];
const leggi = (f, s = 1) => st("Read", { file_path: f }, "ok", s);
const bash = (command, esito, s, errore = false) => st("Bash", { command }, esito, s, errore);
const righe = (n, x) => Array.from({ length: n }, (_, i) => `${x} ${i}`).join("\n");
const edit = (f, piu, meno, s = 1) => st("Edit", { file_path: f, old_string: righe(meno, "prima"), new_string: righe(piu, "dopo") }, "ok", s);
const TRE_FILE = [edit("sessioni/lettore.ts", 142, 3), edit("sessioni/cartelle.ts", 61, 9), edit("sessioni/lettore.test.ts", 11, 0)];

const chat = (x = {}) => ({
  chat: "s1", titolo: null, madre: null, progetto: "clotch", account: ".claude-accountmanager", sorgente: "claude-code", daHandoff: null,
  stato: "lavora", dettaglio: null, aspetto: null, domanda: null, limite: null, richieste: [], battito: ORA - 20_000, aiutanti: {},
  compattazioni: 0, interrotta: null, coda: [], obiettivo: null, passi: [], visto: ORA, fine: null, chatNuova: null, fermata: false,
  quarantena: null, errore: null, rifiuto: null, persi: 0, ...x,
});
const registro = (c) => ({ chat: c ? { s1: c } : {}, fermoTutto: false, avvisi: [], clotch: null, clotchAi: null, comandi: [], decisioni: [],
  regole: [], nonDisturbare: null, impostazioni: null, esiti: {}, errori: [] });

function scena(id, s, msg, { c = null, sezione, info } = {}) {
  const dati = { navigazione: { vista: "sessione", sessione: "s1", ...(sezione ? { sezione } : {}) }, elenco: { sessioni: [sessione(s)], errori: [] },
    messaggi: { s1: msg }, preferenze: { s1: { icona: s.icona ?? "strati" } }, registro: registro(c), ...(info ? { info: { s1: info } } : {}) };
  writeFileSync(new URL(`../design/scene/101-${id}.json`, import.meta.url), JSON.stringify(dati, null, 1) + "\n");
}

const ELECTRON = { titolo: "Clotch: sessioni in Electron", ramo: "design/332-sessioni-figma", icona: "stella",
  obiettivo: { ...OBIETTIVO, testo: "La pagina «Sessioni» in Figma con l’app intera in scuro, con tutti gli stati e pronta per il codice.",
    prove: [{ testo: "Controllo del file: nessun errore", fatta: true }, { testo: "Schermate guardate intere", fatta: true }, { testo: "Sì di Roberto sul disegno", fatta: false }] } };
const TURNO_8036 = [
  u("Fammi l'app Sessioni in Electron con l'aspetto di ChatGPT. Prima il disegno in Figma, poi il codice pari al disegno."), p(14),
  leggi("Research/App/ChatGPT/token-stile.md"), bash("swift test --filter Sessioni", "Test Suite 'SessioniTests' passed", 12),
  a("Ho letto il riferimento di ChatGPT: token, icone e 37 schermate. Creo le variabili con i colori scuri di ChatGPT, poi i componenti."),
  u("Aggiungi anche lo stato con 200 sessioni."),
  bash("npm run build", "src/sessioni/lettore.ts(42,7): error TS2339: Property 'cwd' does not exist on type 'Sessione'.", 3, true), ...TRE_FILE,
  a("Errore corretto. Il controllo del file torna vuoto. Manca solo il tuo sì sul disegno."),
];
const FINITO = { situazione: { adesso: "turno_finito", strumento: null, inCoda: 0, segni: [] } };
scena("8036", { ...ELECTRON, ...FINITO }, messaggi(TURNO_8036));
scena("23727", { ...ELECTRON, ...FINITO }, messaggi(TURNO_8036), { sezione: "menu-risposta" });
scena("20859", { ...ELECTRON, ...FINITO }, messaggi(TURNO_8036), { sezione: "menu-sessione" });

// —— «Stati» e «Chat al lavoro» ——
const ASPETTA = { stato: "aspetta" }, FERMA = { stato: "ferma" };
const DISCO = { titolo: "Sessioni: lettura dal disco", obiettivo: { ...OBIETTIVO, testo: "Leggere dal disco le sessioni di tutte le cartelle ~/.claude-*, di Codex e di Cursor, senza interfaccia." } };
scena("8309", DISCO, messaggi([
  u("Leggi le sessioni dal disco: tutte le cartelle ~/.claude-*, Codex e Cursor."), st("Grep", { pattern: "«claude-code-sessions»", path: "~/Library" }, "", 2),
  a("Trovo 6 cartelle di account e 312 sessioni. Scrivo il lettore e i test."),
  bash("npm test -- lettore", "PASS sessioni/lettore.test.ts (11 test)\nTests: 11 passed, 11 total", 9), bash("npm test -- cartelle", null, 1), [{ tipo: "pensiero", testo: "…" }, 1],
]), { sezione: "aperti:strumento" });
scena("8610", { ...ELECTRON, ...FINITO }, messaggi([
  u("Fammi l'app Sessioni in Electron con l'aspetto di ChatGPT."), p(14), a("Leggo il riferimento di ChatGPT e creo le variabili con i colori scuri."),
  u("Aggiungi lo stato con 200 sessioni."), ...TRE_FILE, a("Fatto. Manca solo il tuo sì sul disegno."),
]), { sezione: "scritta:Aggiungi anche lo stato con 200 sessioni|aperti:pensiero" });
const ALLE_18 = new Date(ORA).setHours(18, 0, 0, 0);
const LIMITE = { limite: { account: ".claude-accountmanager", ripartenza: ALLE_18 }, stato: "ferma_limite" };
scena("9340", { titolo: "AFK: foto dello schermo", icona: "schermo", ramo: "feat/301-afk-foto", ...FERMA, situazione: { adesso: "limite", strumento: null, inCoda: 0, segni: [] },
  obiettivo: { ...OBIETTIVO, testo: "Una foto dello schermo ogni 5 minuti quando Roberto è via, salvata nella cartella AFK.",
    prove: [{ testo: "Test del timer: 6 su 6", fatta: true }, { testo: "Foto salvate in ~/Library/Clotch/AFK", fatta: true }, { testo: "Sì di Roberto sulla prova", fatta: false }] } },
messaggi([u("Fai una foto dello schermo ogni 5 minuti quando sono via."), p(14), edit("Sources/Clotch/AfkStore.swift", 9, 2, 3), a("Ho scritto il salvataggio delle foto. Ora provo il timer.")]),
{ c: chat(LIMITE) });
// 4.862 messaggi: la pagina 0 ne porta 50, i primi 44 sono rifiuti che il filo non mostra
const RIFIUTI = Array.from({ length: 44 }, () => st("Bash", { command: "x" }, "The user doesn't want to proceed with this tool use.", 1, true));
scena("9628", { ...ELECTRON, ...FINITO, titolo: "Clotch: sessioni in Electron con lettura dal disco di tutte le cartelle degli account, filtri per sorgente e stato, ricerca globale e impostazioni come quelle di ChatGPT" },
  [...Array.from({ length: 4812 }, (_, i) => ({ tipo: "assistente", testo: `vecchio ${i}`, modello: null, t: ORA - 86_400_000 })), ...messaggi([...RIFIUTI,
    u("Controlla anche la sessione con migliaia di messaggi."), bash("swift test --filter Sessioni", "Test Suite 'SessioniTests' passed\nExecuted 14 tests, with 0 failures in 0.412 seconds", 12),
    ...TRE_FILE, a("Si apre sugli ultimi 50 messaggi. Gli altri 4.812 si caricano quando sali.")])], { sezione: "aperti:strumento,file-toccati" });
scena("9841", { titolo: "Voce: parole inglesi", icona: "microfono", ramo: "fix/323-parole-inglesi", ...FERMA, obiettivo: null, situazione: null }, []);
const RICOMPILA = [u("Ricompila l’app dopo il cambio della barra laterale."), leggi("sessioni/package.json"), a("La cartella della build è vecchia: la svuoto e ricompilo.")];
scena("13650", ASPETTA, messaggi(RICOMPILA), { c: chat({ stato: "serve_roberto", richieste: [{ rid: "r1", genere: "permesso", strumento: "Bash",
  ingresso: { command: "rm -rf sessioni/dist && npm run build", description: "Svuota la cartella della build e ricompila l’app." }, domande: [] }] }) });
const DOMANDA = { questions: [{ question: "Dove salvo le immagini della prova di parità?", options: [{ label: "Nel repo, in sessioni/design/app (Recommended)" },
  { label: "Nella cartella appunti della sessione" }, { label: "Non salvarle: mostrale e basta" }] }] };
scena("13896", { ...ASPETTA, ultimaAttivita: ORA - 5 * MIN }, messaggi([
  u("Fai la prova di parità di tutte le schermate."), bash("npm run prova -- --scala 1", "ok", 41), a("Le 14 immagini sono pronte. Prima di salvarle ho un dubbio."),
  st("AskUserQuestion", DOMANDA, null, 1),
]), { c: chat({ stato: "serve_roberto", richieste: [{ rid: "r2", genere: "domanda", strumento: "AskUserQuestion", ingresso: DOMANDA, domande: [] }] }) });
const PIANO = "Porto la pagina «Sessioni» nel codice, una schermata alla volta.\n1. Leggo token e frame dal disegno\n2. Scrivo barra laterale e conversazione\n3. Disegno ogni stato a scala 1 e lo confronto col disegno\n4. Apro la PR verso dev con le prove";
const PORTA = u("Porta il disegno Sessioni nel codice, pari pari.");
scena("14132", ASPETTA, messaggi([PORTA, p(14), st("ExitPlanMode", { plan: PIANO }, null, 1)]),
  { c: chat({ stato: "serve_roberto", richieste: [{ rid: "r3", genere: "piano", strumento: "ExitPlanMode", ingresso: { plan: PIANO }, domande: [] }] }) });
const PASSI = ["Leggere i token dal disegno", "Scrivere la barra laterale", "Scrivere la conversazione", "Confrontare ogni stato col disegno", "Aprire la PR verso dev"];
const todo = (fatti, inCorso) => st("TodoWrite", { todos: PASSI.map((content, i) => ({ content, status: i < fatti ? "completed" : i === inCorso ? "in_progress" : "pending" })) }, "ok", 1);
const agente = (description, esito, s) => st("Agent", { description, subagent_type: "general-purpose" }, esito, s);
const AIUTANTI = { aiutanti: { a1: { tipo: "general-purpose", modello: "claude-sonnet-5-5", testo: null, esito: null, finito: false } } };
scena("14396", {}, messaggi([PORTA, st("ExitPlanMode", { plan: PIANO }, "ok", 1), todo(2, 2),
  agente("Lettore", null, 12), agente("Controllo tipi", null, 8), agente("Prove", null, 41), [{ tipo: "pensiero", testo: "…" }, 1]]), { c: chat(AIUTANTI) });
scena("14631", {}, messaggi([u("Togli i gruppi per data dalla barra laterale."), st("Grep", { pattern: "raggruppaPerData", path: "sessioni/src" }, "ok", 1),
  st("Edit", { file_path: "sessioni/src/BarraLaterale.tsx", old_string: "  const sessioni = useSessioni(filtro);\n  const gruppi = raggruppaPerData(sessioni);\n  return <Gruppi gruppi={gruppi} />;",
    new_string: "  const sessioni = useSessioni(filtro);\n  const progetti = raggruppaPerCartella(sessioni);\n  return <>\n    <RigaClotchAi />\n    <Progetti progetti={progetti} /></>;" }, "ok", 1),
  a("Ho tolto i gruppi per data: ora la barra laterale mostra solo le cartelle dei progetti, con clotch AI fissa in alto. Adesso controllo che i titoli lunghi si taglino bene")]));
const ELENCO = [u("Aggiungi lo stato con 200 sessioni."), leggi("sessioni/src/Elenco.tsx"), bash("npm test -- elenco", null, 1)];
const CODA = chat({ coda: [{ voce: "v1", testo: "Ascolta, ho bisogno anche di un’altra cosa: sul mio Mac c’è un collegamento che non apre la cartella giusta e vorrei capire perché" }] });
scena("14849", {}, messaggi(ELENCO), { c: CODA });
scena("43332", {}, messaggi(ELENCO), { sezione: "scritta:Prima di continuare, controlla anche i titoli lunghi" });
scena("43535", {}, messaggi([...ELENCO.slice(0, 2), u("[Request interrupted by user]"), u("Prima di continuare, controlla anche i titoli lunghi."), [{ tipo: "pensiero", testo: "…" }, 1]]));
scena("43708", {}, messaggi(ELENCO), { c: CODA, sezione: "modifica" });
scena("43945", {}, messaggi(ELENCO), { c: CODA, sezione: "suggerimento" });
scena("15055", FERMA, messaggi([u("Rifai tutta la barra laterale."), leggi("sessioni/src/BarraLaterale.tsx"), u("[Request interrupted by user]"), u("Fermati: prima mostrami il disegno in Figma.")]));
scena("15335", { stato: "finita", situazione: { adesso: "turno_finito", strumento: null, inCoda: 0, segni: [] } }, messaggi([
  u("This session is being continued from a previous conversation that ran out of context."), PORTA, todo(5, -1),
  agente("Lettore", "Ha letto 4 file", 12), agente("Controllo tipi", "Nessun errore", 8), agente("Prove", "14 stati pari al disegno", 41), ...TRE_FILE,
  a("Fatto. Le 14 schermate sono pari al disegno; la PR verso dev è aperta."),
]), { c: chat({ aiutanti: { a1: { ...AIUTANTI.aiutanti.a1, finito: true } } }) });
const LINK = (t, u) => ({ title: t, url: u });
scena("15577", FINITO, messaggi([u("Come si fa la barra laterale trasparente su Mac?"),
  st("WebSearch", { query: "electron vibrancy sidebar macOS" }, `Links: ${JSON.stringify([LINK("BrowserWindow: vibrancy e visualEffectState", "https://electronjs.org/docs"),
    LINK("Barra laterale trasparente su macOS", "https://github.com/x"), LINK("NSVisualEffectView", "https://developer.apple.com/x"), LINK("Barra del titolo nascosta con i semafori", "https://stackoverflow.com/x")])}`, 1),
  a("Con vibrancy «sidebar» sulla finestra e lo sfondo della barra trasparente. Lo provo adesso.")]));
scena("15790", FINITO, messaggi([u("Spedisci tutto in produzione."), bash("git push origin main", "PreToolUse:Bash git push su main non è permesso. La sessione prova un’altra strada.", 0.4, true),
  a("Apro la PR verso dev: la promozione a main parte da lì.")]));
// oltre i 20 minuti del contratto (NON_RISPONDE_MS): il frame mostra «6 min», qui è «21 min»
scena("15993", {}, messaggi([u("Lancia tutte le prove."), bash("npm test", null, 1)], 6 * MIN), { c: chat({ battito: ORA - 21 * MIN }) });
scena("16211", { ...FERMA, situazione: { adesso: "limite", strumento: null, inCoda: 0, segni: [] } },
  messaggi([u("Continua con le schermate degli stati."), a("Ho finito 9 schermate su 14.")]), { c: chat(LIMITE) });
scena("45507", { ...ASPETTA, titolo: "Backend: auth e RLS", icona: "database", progetto: "squadd-v2", ramo: "feat/2412-rls-sessioni", account: ".claude-squadd",
  obiettivo: { ...OBIETTIVO, testo: "Policy RLS di «sessioni» per ogni studio, provate sul database di sviluppo e promosse su main.",
    prove: [{ testo: "Test delle policy: 14 su 14", fatta: true }, { testo: "Migrazione 0042 provata su dev", fatta: true }, { testo: "Sì di Roberto alla promozione", fatta: false }] } },
messaggi([u("Applica le policy RLS di «sessioni» e promuovi su main."), bash("gh pr checks 2412", "ok", 6),
  a("I controlli della PR sono verdi: 14 su 14. La migrazione 0042 cambia le policy di «sessioni» in produzione. Vuoi che promuova adesso?")]),
  { sezione: "da-clotch-ai", info: { contesto: null, file: { quanti: 3, aggiunte: 214, tolte: 12 } } }); // aperta da clotch AI (101:45507)

// —— Chat clotch AI (101:16432) e sessioni da citare dopo @ (101:45260) ——
function scenaClotchAi(id, domande, sezione, sessioni = [], chats = {}) {
  const r = registro(chat({ chat: "friday", progetto: null, visto: ORA - 10_000, battito: ORA - 10_000 })); // nome del protocollo del motore
  r.chat = { friday: r.chat.s1, ...chats }; // nome del protocollo del motore
  let t = ORA - 10 * MIN;
  for (const [i, [d, rs, citate = []]] of domande.entries()) {
    r.comandi.push({ id: `c${i}`, t: (t += 20_000), cmd: "parla", da: "app", args: { testo: d } });
    r.avvisi.push({ id: `a${i}`, t: (t += 20_000), testo: rs, livello: "info", motivo: "risposta", dettoDa: null, sessioni: citate });
  }
  const dati = { navigazione: { vista: "clotch-ai", ...(sezione ? { sezione } : {}) }, elenco: { sessioni, errori: [] }, messaggi: {},
    preferenze: Object.fromEntries(sessioni.map((s) => [s.id, { icona: s.icona }])), registro: r };
  writeFileSync(new URL(`../design/scene/101-${id}.json`, import.meta.url), JSON.stringify(dati, null, 1) + "\n");
}
const BACKEND = [["Com’è messa la sessione del backend?", "«Backend: auth e RLS» aspetta un tuo permesso da 12 minuti: vuole lanciare la migrazione su dev."]];
scenaClotchAi("16432", [...BACKEND, ["Consentila tu.", "Fatto. La migrazione è partita; ti avviso quando finisce."]]);
scenaClotchAi("45260", [...BACKEND, ["Consentila tu.", "Fatto. La migrazione è partita; ti avviso quando finisce."]], "scritta:Ferma @back", [
  sessione({ id: "b1", titolo: "Backend: auth e RLS", icona: "database", progetto: "squadd-v2", stato: "aspetta" }),
  sessione({ id: "b2", titolo: "Backup Hetzner sulle VPS", icona: "pacco", progetto: "squadd-v2", stato: "finita" }),
  sessione({ id: "b3", titolo: "Backend: webhook pagamenti", icona: "database", progetto: "dentalspace", stato: "ferma" }),
]);

// —— clotch AI cita le sessioni (101:44748) e scheda al passaggio (101:44989) ——
const CITATE = [
  sessione({ id: "b1", titolo: "Backend: auth e RLS", icona: "database", progetto: "squadd-v2", ramo: "feat/2412-rls-sessioni", stato: "aspetta", ultimaAttivita: ORA - 12 * MIN }),
  sessione({ id: "f1", titolo: "Figma: schermate app Sessioni", icona: "tavolozza", ramo: "design/332-sessioni-figma-3", stato: "aspetta", ultimaAttivita: ORA - 5 * MIN }),
  sessione({ id: "l1", titolo: "Sessioni: disegno e app Electron", icona: "stella", ramo: "design/332-sessioni-figma-3" }),
  sessione({ id: "l2", titolo: "clotch AI: casella e sandbox", icona: "fulmine" }),
  sessione({ id: "l3", titolo: "Notch: avviso schermo", icona: "schermo" }),
];
const passi5 = ["completed", "completed", "completed", "in_progress", "pending"].map((stato, i) => ({ testo: `passo ${i}`, stato }));
const CHAT_CITATE = {
  b1: chat({ chat: "b1", stato: "serve_roberto", dettaglio: "Vuoi che promuova adesso?", richieste: [{ rid: "rb", genere: "permesso", strumento: "Bash", ingresso: {}, domande: [] }] }),
  f1: chat({ chat: "f1", stato: "serve_roberto", domanda: "Dove salvo le immagini della prova di parità?", richieste: [{ rid: "rf", genere: "domanda", strumento: "AskUserQuestion", ingresso: {}, domande: [] }] }),
  l1: chat({ chat: "l1", dettaglio: "Disegno le schermate di clotch AI nell’app.", passi: passi5 }),
};
const ASPETTANO = [["Cosa aspetta me?", "Due sessioni aspettano te.", ["b1", "f1", "l1", "l2", "l3"]]];
scenaClotchAi("44748", ASPETTANO, null, CITATE, CHAT_CITATE);
scenaClotchAi("44989", ASPETTANO, "scheda:l1", CITATE, CHAT_CITATE);
