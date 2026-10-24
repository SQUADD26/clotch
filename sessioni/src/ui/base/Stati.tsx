// figma: 101-8805 — stati vuoto (101-8805) ed errore (101-9090): «Messaggio al centro»; caricamento (101-8912): sagome.
import type { CSSProperties, ReactNode } from "react";
import caricamento from "../../../design/figma/101-8912.json";
import type { ErroreLettura } from "../../tipi";
import { Bottone } from "./Bottone";
import "./stati.css";

/** Vuoto ed errore: titolo, testo e bottoni al centro della superficie. Testi dal frame Figma della situazione. */
/** `allarme`: un errore, VoiceOver lo dice appena compare (#866). */
export function MessaggioAlCentro({ titolo, corpo, allarme, children }: { titolo: string; corpo: string; allarme?: boolean; children?: ReactNode }) {
  return (
    <div className="messaggio-al-centro" role={allarme ? "alert" : undefined}>
      <div className="t-xl" role="heading" aria-level={2}>{titolo}</div>
      <div className="t-base secondario">{corpo}</div>
      {children && <div className="bottoni">{children}</div>}
    </div>
  );
}

/** Errore con «Riprova» (testo di 101-9090): per una chiamata fallita di dati.ts. */
export function StatoErrore({ titolo, corpo, riprova, children }: { titolo: string; corpo: string; riprova(): void; children?: ReactNode }) {
  return (
    <MessaggioAlCentro titolo={titolo} corpo={corpo} allarme>
      {children}
      <Bottone tipo="secondario" onClick={riprova}>Riprova</Bottone>
    </MessaggioAlCentro>
  );
}

/** «Vuoto» (101-8805): l'elenco è arrivato e non ha sessioni. */
export function NessunaSessione({ aggiungi, impostazioni }: { aggiungi(): void; impostazioni(): void }) {
  return (
    <MessaggioAlCentro titolo="Nessuna sessione" corpo={"Qui appaiono le sessioni di Claude Code, Claude, Codex e Cursor di questo Mac.\nApri una sessione in una di queste app, o aggiungi la cartella di un account."}>
      <Bottone onClick={aggiungi}>Aggiungi cartella</Bottone>
      <Bottone tipo="secondario" onClick={impostazioni}>Apri impostazioni</Bottone>
    </MessaggioAlCentro>
  );
}

const IMPOSTAZIONI_DI_SISTEMA = "/System/Applications/System Settings.app"; // shortcut: apre l'app, non il pannello «Accesso completo al disco»; da cambiare se serve il pannello

/** Il messaggio del main (jsonl.ts `msgErrore`) in parole semplici: gli errori di sistema, in inglese e con percorsi, non si mostrano. */
export const motivoErrore = (m: string) => m === "permesso negato" ? "permesso negato" : m === "file sparito" ? "non c’è più" : "non si apre";

const MAX_CARTELLE = 3;

/** «Errore cartella» (101-9090): nessuna sessione da mostrare perché una cartella non si legge. Il permesso negato è quasi sempre l’accesso completo al disco del Mac.
 *  Con più cartelle le nomina tutte (le prime tre, poi «e altre N»). */
export function CartellaNonLeggibile({ errori, riprova }: { errori: ErroreLettura[]; riprova(): void }) {
  const permesso = errori.some((e) => e.messaggio === "permesso negato");
  const uno = errori.length === 1;
  const lista = errori.slice(0, MAX_CARTELLE).map((e) => `${e.percorso}: ${motivoErrore(e.messaggio)}`).join("\n");
  const altre = errori.length > MAX_CARTELLE ? `\ne altre ${errori.length - MAX_CARTELLE}` : "";
  return (
    <MessaggioAlCentro allarme titolo={uno ? "Cartella non leggibile" : "Cartelle non leggibili"}
      corpo={`${uno ? `clotch non può leggere ${lista}.` : `clotch non può leggere ${errori.length} cartelle:\n${lista}${altre}`}${permesso ? "\nDai a clotch l’accesso completo al disco in Impostazioni di Sistema › Privacy e sicurezza, poi riprova." : ""}`}>
      {permesso && <Bottone onClick={() => void window.impostazioni.apri(IMPOSTAZIONI_DI_SISTEMA).catch(() => {})}>Apri Impostazioni di Sistema</Bottone>}
      <Bottone tipo="secondario" onClick={riprova}>Riprova</Bottone>
    </MessaggioAlCentro>
  );
}

// Sagome lette dal frame 101-8912: righe del filo e loro sagome, larghezze in proporzione alla colonna.
interface Nodo { nome: string; box: { x: number; y: number; w: number; h: number }; variabili: Record<string, string | undefined> }
const nodi = caricamento.nodi as unknown as Nodo[];
const v = (nome?: string) => nome && `var(--${nome.replace(/\//g, "-")})`;
const dentro = (a: Nodo["box"], b: Nodo["box"]) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const filo = nodi.find((n) => n.nome === "Filo")!;
const righe = nodi.filter((n) => /sagoma$/.test(n.nome) && n.nome !== "sagoma").map((r) => ({
  bolla: r.nome === "bolla sagoma",
  gap: r.variabili.itemSpacing,
  sagome: nodi.filter((s) => s.nome === "sagoma" && dentro(s.box, r.box)),
}));

/** Caricamento: sagome al posto dei messaggi, come nel frame «Caricamento». */
export function Sagome() {
  const stileFilo: CSSProperties = { gap: v(filo.variabili.itemSpacing), paddingTop: v(filo.variabili.paddingTop), paddingBottom: v(filo.variabili.paddingBottom) };
  return (
    <div className="sagome" style={stileFilo} role="progressbar" aria-label="Caricamento" aria-busy="true">
      {righe.map((r, i) => (
        <div key={i} className={r.bolla ? "riga bolla" : "riga"} style={{ gap: v(r.gap) }}>
          {r.sagome.map((s, j) => (
            <div key={j} style={{
              width: `${(s.box.w / filo.box.w) * 100}%`, height: s.box.h,
              background: v(s.variabili["fills[0]"]), borderRadius: v(s.variabili.cornerRadius),
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}
