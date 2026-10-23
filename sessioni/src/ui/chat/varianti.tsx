// figma: 101-19480 — «Varianti della chat»: il foglio con un'istanza di ogni variante dei pezzi, ognuna al suo posto (misure dal json del frame).
// Prova di parità: `npm run parita -- 101-19480`. Disegna i pezzi veri con i loro dati; quelli che il ramo non ha ancora o che sono d'altri gruppi
// (Riga Friday, Casella spunta, Pillola filtro, Riga sessione, Chip allegato, Indicatore PR, Riga sessione annidata, Casella voce, Avviso a comparsa,
// Riferimento sessione, Scheda sessione) restano vuoti nel foglio: li disegna chi li costruisce, a unione fatta.
import type { ReactElement, ReactNode } from "react";
import foglio from "../../../design/figma/101-19480.json";
import { Bottone } from "../base/Bottone";
import { Pezzo } from "../base/Pezzo";
import { opzioni } from "../barra/elenco";
import { MenuOpzioni, MenuProprieta } from "../barra/Filtri";
import { PannelloObiettivo } from "../pannello/PannelloObiettivo";
import { statiDelFoglio } from "../pannello/scene";
import { Modifica } from "./Blocchi";
import { Aiutanti, Attivita } from "./Lavoro";
import { Domanda, Esito, Permesso, Piano } from "./Richieste";
import type { Aiutante, Passo } from "./modello";

interface Nodo { id: string; nome: string; box: { x: number; y: number; w: number } }
const nodi = foglio.nodi as unknown as Nodo[];

/** Un'istanza del foglio, al suo posto e della sua larghezza. */
function Posto({ id, children }: { id: string; children: ReactNode }) {
  const b = nodi.find((n) => n.id === id)!.box;
  return <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, display: "flex", flexDirection: "column" }}>{children}</div>;
}

const COMANDO = "rm -rf sessioni/dist && npm run build";
const PIANO = ["Porto la pagina «Sessioni» nel codice, una schermata alla volta.", "1. Leggo token e frame dal disegno", "2. Scrivo barra laterale e conversazione",
  "3. Disegno ogni stato a scala 1 e lo confronto col disegno", "4. Apro la PR verso dev con le prove"].join("\n");
const TESTI = ["Leggere i token dal disegno", "Scrivere la barra laterale", "Scrivere la conversazione", "Confrontare ogni stato col disegno", "Aprire la PR verso dev"];
const passi = (...stati: Passo["stato"][]): Passo[] => TESTI.map((testo, i) => ({ testo, stato: stati[i] }));
const aiutanti = (finito: boolean): Aiutante[] => [
  ["Lettore", "Legge sessioni/src/lettore.ts", "Ha letto 4 file", 12], ["Controllo tipi", "Lancia npm run typecheck", "Nessun errore", 8], ["Prove", "Disegna 14 stati a scala 1", "14 stati pari al disegno", 41],
].map(([nome, lavora, fatto, s], i) => ({ id: `a${i}`, nome: String(nome), azione: String(finito ? fatto : lavora), durata: Number(s) * 1000, finito }));
const modifica = {
  tipo: "modifica" as const, id: "m1", file: "sessioni/src/BarraLaterale.tsx", aggiunte: 4, tolte: 2, durata: null,
  righe: [
    { segno: " " as const, codice: "  const sessioni = useSessioni(filtro);" },
    { segno: "-" as const, codice: "  const gruppi = raggruppaPerData(sessioni);" }, { segno: "-" as const, codice: "  return <Gruppi gruppi={gruppi} />;" },
    { segno: "+" as const, codice: "  const progetti = raggruppaPerCartella(sessioni);" }, { segno: "+" as const, codice: "  return <>" },
    { segno: "+" as const, codice: "    <Rigaclotch AI />" }, { segno: "+" as const, codice: "    <Progetti progetti={progetti} /></>;" },
  ],
};

const nulla = () => {};
const punto = (id: string) => { const b = nodi.find((n) => n.id === id)!.box; return { x: b.x, y: b.y }; };

function Varianti() {
  const pannelli = statiDelFoglio();
  const idPannelli = nodi.filter((n) => n.nome === "Pannello obiettivo").sort((a, b) => a.box.x - b.box.x);
  return (
    <div className="foglio-varianti" style={{ position: "relative" }}>
      <Posto id="101:19481"><Permesso chat="s1" r={{ rid: "r1", strumento: "Bash", ingresso: { command: COMANDO, description: "Svuota la cartella della build e ricompila l’app." } }} da="da 2 min" /></Posto>
      <Posto id="101:19499"><Esito icona="spunta" colore="successo" esito="Consentito da te" dettaglio={COMANDO} codice /></Posto>
      <Posto id="101:19504"><Esito icona="chiudi" colore="errore" esito="Negato da te" dettaglio={COMANDO} codice /></Posto>
      <Posto id="101:19509">
        <Domanda chat="s1" rid="d1" da="da 5 min" domande={[{ domanda: "Dove salvo le immagini della prova di parità?",
          opzioni: ["Nel repo, in sessioni/design/app (Recommended)", "Nella cartella appunti della sessione", "Non salvarle: mostrale e basta"] }]} />
      </Posto>
      <Posto id="101:19534"><Esito icona="persona" colore="secondaria" esito="Hai risposto" dettaglio="Nel repo, in sessioni/design/app" /></Posto>
      <Posto id="101:19539"><Piano chat="s1" rid="p1" testo={PIANO} /></Posto>
      <Posto id="101:19564"><Esito icona="spunta" colore="successo" esito="Piano approvato" dettaglio="4 passi" /></Posto>
      <Posto id="101:19569"><Attivita passi={passi("fatto", "fatto", "fatto", "fatto", "fatto")} /></Posto>
      <Posto id="101:19595"><Attivita passi={passi("fatto", "fatto", "in-corso", "da-fare", "da-fare")} /></Posto>
      <Posto id="101:19621"><Aiutanti aiutanti={aiutanti(false)} modello="Sonnet 5.5" /></Posto>
      <Posto id="101:19645"><Aiutanti aiutanti={aiutanti(true)} modello="Sonnet 5.5" /></Posto>
      <Posto id="101:19669"><Modifica b={modifica} aperta /></Posto>
      <Posto id="101:19701"><Modifica b={modifica} aperta={false} /></Posto>
      <Posto id="101:35385"><Bottone tipo="secondario">Apri impostazioni</Bottone></Posto>
      <Posto id="101:35387"><Bottone tipo="secondario">Apri impostazioni</Bottone></Posto>
      <Pezzo nome="barra">
        <MenuOpzioni a={punto("101:19734")} filtro={{ proprieta: "stato", valori: ["aspetta"] }} opzioni={opzioni([], "stato", 0)} onCambia={nulla} onRimuovi={nulla} onChiudi={nulla} />
        <MenuProprieta a={punto("101:19774")} onScegli={nulla} onChiudi={nulla} />
      </Pezzo>
      {/* il foglio ha 9 pannelli: i 5 stati e, dal sesto, gli ultimi 4 un'altra volta */}
      {idPannelli.map((n, i) => { const p = pannelli[i < pannelli.length ? i : i - pannelli.length + 1]; return p && <Posto key={n.id} id={n.id}><Pezzo nome="pannello"><PannelloObiettivo dati={p.dati} /></Pezzo></Posto>; })}
    </div>
  );
}

/** Scene della prova di parità della chat: `?parita=<node-id>`. */
export const scene: Record<string, () => ReactElement> = { "101-19480": Varianti };
