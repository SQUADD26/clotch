// Scene di prova di allegati e immagini (#437): `node scripts/scene-allegati.mjs` scrive design/scene/101-<id>.json per i frame
// 25845 (menu Aggiungi), 28041 (immagini e allegati nel filo), 28232 (visore) e, per le miniature nella casella (#469): 148-46383 (una immagine),
// 148-47483 (tanti, la riga scorre), 148-49251 (file troppo grande) e 148-45727 (trascinamento). I vecchi 101-25542 e 101-27294 (chip, zona di rilascio) non ci sono più.
// Parte dalla scena 101-8036 (stessa finestra, stesso filo), da rifare con scene-chat.mjs se cambia.
import { readFileSync, writeFileSync } from "node:fs";

const scena = (id) => JSON.parse(readFileSync(new URL(`../design/scene/101-${id}.json`, import.meta.url), "utf8"));
const scrivi = (id, s) => writeFileSync(new URL(`../design/scene/${id.includes("-") ? id : `101-${id}`}.json`, import.meta.url), JSON.stringify(s, null, 1) + "\n");
const base = scena("8036");
const con = (sezione, extra = {}) => ({ ...base, navigazione: { ...base.navigazione, sezione }, ...extra });

// il filo di 25845 e 27294 è quello di 8036; la casella cambia
scrivi("25845", con("scritta:Aggiungi anche lo stato con 200 sessioni|menu-aggiungi", { skill: ["figma-ui-design", "app-copy", "ponytail"] }));
// 148-*: miniature nella casella; la scena è quella di 8036 con la barra e il pannello di «File toccati»; i file e le immagini stanno in ALLEGATI_PROVA (Allegati.tsx)
const casella = structuredClone(base);
Object.assign(casella.elenco.sessioni[0], { permessi: "default", contesto: 124_000 }); // 62% di 200 000, come il disegno
casella.info = { s1: { contesto: 124_000, file: { quanti: 3, aggiunte: 214, tolte: 12 } } };
casella.registro = { ...casella.registro, clotch: { voce: "accesa", parla: false, ascolta: false, versione: "2.4", t: -60_000 } }; // con clotch acceso il filo non ha la nota «Senza clotch»
const DESKTOP = "/Users/privato/Desktop", FIN = "design/scene/immagini";
const immaginiCasella = { [`${DESKTOP}/schermata-notch.png`]: `${FIN}/allegato-scura.png`, [`${DESKTOP}/moduli.png`]: `${FIN}/allegato-chiara.png`, [`${DESKTOP}/cantiere.png`]: `${FIN}/allegato-blu.png` };
const miniature = (id, testo, chiave, extra = "") => scrivi(id, { ...casella, immagini: immaginiCasella,
  navigazione: { ...base.navigazione, sezione: `scritta:${testo}|allegati:${chiave}${extra}` } });
const NOTCH = "Guarda la schermata: il notch copre il titolo della sessione.";
miniature("148-46383", NOTCH, "una-immagine");
miniature("148-47483", "Guarda la schermata e i file: il notch copre il titolo e il lettore va in errore. Sistema tutto, poi rifai la prova di parità a scala 1.", "tanti");
miniature("148-49251", "Guarda la registrazione: dopo il clic il notch sparisce.", "troppo-grande");
miniature("148-45727", NOTCH, "trascinamento", "|rilascio");

// 28041 e 28232: un messaggio con due file e una schermata dello strumento; la stessa immagine fa da miniatura e da pagina del visore
const T = base.messaggi.s1.at(-1).t - 60_000;
const DIR = "/Users/privato/Desktop";
const IMMAGINE = "design/scene/immagini/notch-sopra-il-titolo.png";
const messaggi = [
  { tipo: "utente", testo: `Guarda la schermata: il notch copre il titolo della sessione.\n@${DIR}/schermata-notch.png\n@${DIR}/lettore.ts`, t: T },
  { tipo: "strumento", id: "t-schermata", nome: "Screenshot", ingresso: { name: "notch-sopra-il-titolo.png" }, t: T + 1_000,
    esito: { testo: "", errore: false, immagini: [{ riga: "scena-schermata-0001", n: 0, mime: "image/png", byte: 136_000 }] } },
  { tipo: "assistente", testo: "Il notch copre i primi 40 px della barra del titolo. Sposto il titolo sotto i semafori.", modello: "claude-opus-5-5", t: T + 3_000 },
];
const filo = {
  messaggi: { s1: messaggi },
  allegati: [
    { percorso: `${DIR}/schermata-notch.png`, nome: "schermata-notch.png", tipo: "immagine", byte: 312_000 },
    { percorso: `${DIR}/lettore.ts`, nome: "lettore.ts", tipo: "file", byte: 4_000 },
  ],
  immagini: { "scena-schermata-0001:0": IMMAGINE, [`${DIR}/schermata-notch.png`]: IMMAGINE },
};
scrivi("28041", con(undefined, filo));
scrivi("28232", con("visore:0", filo));
