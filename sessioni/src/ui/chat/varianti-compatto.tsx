// figma: 163-84565 — fogli dei pezzi del filo compatto (#876): ogni variante al suo posto del frame, coi pezzi veri (Compatto.tsx).
// Prova di parità: `npm run parita -- 163-84137` (e 84207, 84216, 84329, 84382, 84565). Passaggio, premuto e fuoco si forzano con una classe.
import type { ReactElement, ReactNode } from "react";
import gruppo from "../../../design/figma/163-84137.json";
import riga from "../../../design/figma/163-84207.json";
import inCorso from "../../../design/figma/163-84216.json";
import ragionamento from "../../../design/figma/163-84329.json";
import aiutante from "../../../design/figma/163-84382.json";
import elenco from "../../../design/figma/163-84565.json";
import { Aiutanti, Gruppo, Ragionamento, RigaStrumento } from "./Compatto";
import { raggruppa, type BloccoStrumento, type Gruppo as DatiGruppo } from "./gruppi";
import type { Aiutante, Blocco } from "./modello";
import { descrivi, type StatoStrumento } from "./strumenti";

type Foglio = { nodi: { id: string; box: { x: number; y: number; w: number; h: number } }[] };

function Posto({ f, id, forza, children }: { f: Foglio; id: string; forza?: "passaggio" | "premuto" | "fuoco"; children: ReactNode }) {
  const b = f.nodi.find((n) => n.id === id)!.box;
  return <div className={forza && `forza-${forza}`} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 var(--spazio-2)" }}>{children}</div>;
}
const Tela = ({ children }: { children: ReactNode }) => <div className="filo" style={{ position: "relative", height: "100%", overflow: "hidden", background: "var(--colore-fondo-superficie)" }}><div className="turno">{children}</div></div>;

let n = 0;
const st = (nome: string, ingresso: object, durata: number | null, stato: StatoStrumento = "chiusa", uscita = ""): BloccoStrumento =>
  ({ tipo: "strumento", id: `v${n++}`, stato, durata, uscita, ...descrivi(nome, ingresso, stato, "", uscita) });
const GH = "gh api 'repos/SQUADD26/gestionale-interno/contents/src/hooks/useRoleAccess.ts?ref=dev' --jq .content | base64 -d";
const CINQUE = [st("Grep", { pattern: "canAccess" }, 200, "chiusa", "Found 4 files"), st("Read", { file_path: "src/hooks/useRoleAccess.ts" }, 300),
  st("Bash", { command: GH }, 3000), st("Bash", { command: "npm run e2e" }, 5000, "errore", "Exit code 1"), st("screenshot", { name: "la pagina Dashboard" }, 23000)];
const ALTRI = [st("Read", { file_path: "src/AppSidebar.tsx" }, 400), st("Read", { file_path: "src/useEffectiveAuth.ts" }, 300), st("Grep", { pattern: "Live chat" }, 600, "chiusa", "Found 12 files"),
  st("Read", { file_path: "src/sb.tsx" }, 200), st("Bash", { command: "npm run typecheck" }, 2000), st("Read", { file_path: "src/Ricerca.tsx" }, 400), st("Read", { file_path: "src/Filo.tsx" }, 300)];
const g = (blocchi: BloccoStrumento[], x: Partial<DatiGruppo> = {}) => ({ ...(raggruppa(blocchi)[0] as DatiGruppo), ...x });
const DODICI = g([...CINQUE, ...ALTRI.slice(0, 7)], { durata: 48_000, errori: [] });
const ERRORE = { ...DODICI, errori: [CINQUE[3]] };
const VIVO = g([st("Read", { file_path: "a" }, 1000), st("Read", { file_path: "b" }, 1000), st("Read", { file_path: "sessioni/src/ui/chat/Filo.tsx" }, null, "in-corso")]);
const PENSIERO = "Il filo mostra una riga per ogni strumento. Raggruppo gli strumenti del turno in una riga sola, chiusa. Apro il gruppo solo se Roberto lo chiede.";
const pensiero = (inCorso: boolean): Extract<Blocco, { tipo: "pensiero" }> => ({ tipo: "pensiero", testo: PENSIERO, durata: 14_000, inCorso });
const ai = (nome: string, finito: boolean, errore = false, durata = 12_000): Aiutante =>
  ({ id: nome, nome, azione: "", durata, finito, errore, rapporto: finito ? "Ho controllato i tipi di sessioni/src. Nessun errore. 214 file letti, 0 avvisi. " : "" });

const RICERCA = st("Read", { file_path: "Ricerca.tsx" }, 400);
const riga1 = (b: BloccoStrumento, aperta = false) => <div className="compatto"><RigaStrumento b={b} aperta={aperta} /></div>;

function Righe({ f, posti }: { f: Foglio; posti: [string, ReactNode, ("passaggio" | "premuto" | "fuoco")?][] }) {
  return <Tela>{posti.map(([id, x, forza]) => <Posto key={id} f={f} id={id} forza={forza}>{x}</Posto>)}</Tela>;
}

const fogli: Record<string, () => ReactElement> = {
  "163-84137": () => <Righe f={gruppo} posti={[
    ["163:84104", <Gruppo g={DODICI} />], ["163:84109", <Gruppo g={DODICI} />, "passaggio"], ["163:84114", <Gruppo g={DODICI} />, "premuto"],
    ["163:84119", <Gruppo g={DODICI} />, "fuoco"], ["163:84124", <Gruppo g={DODICI} aperto />], ["163:84129", <Gruppo g={ERRORE} />]]} />,
  "163-84207": () => <Righe f={riga} posti={[
    ...(["163:84138", "163:84146", "163:84156", "163:84166"] as const).map((id, i) => [id, riga1(RICERCA), [undefined, "passaggio", "premuto", "fuoco"][i]] as [string, ReactNode, "passaggio"]),
    ["163:84176", riga1(CINQUE[2], true)], ["163:84190", riga1(CINQUE[3])], ["163:84198", riga1(CINQUE[4])]]} />,
  "163-84216": () => <Righe f={inCorso} posti={[["163:84208", <Gruppo g={VIVO} />], ["163:84211", <div className="fermo"><Gruppo g={VIVO} /></div>]]} />,
  "163-84329": () => <Righe f={ragionamento} posti={[["163:84308", <Ragionamento b={pensiero(true)} />], ["163:84311", <div className="fermo"><Ragionamento b={pensiero(true)} /></div>],
    ["163:84316", <Ragionamento b={pensiero(false)} />], ["163:84321", <Ragionamento b={pensiero(false)} aperto />]]} />,
  "163-84382": () => <Righe f={aiutante} posti={[["163:84330", <Aiutanti aiutanti={[ai("Controlla i tipi", false)]} />], ["163:84338", <div className="fermo"><Aiutanti aiutanti={[ai("Controlla i tipi", false)]} /></div>],
    ["163:84346", <Aiutanti aiutanti={[ai("Controlla i tipi", true, false, 8000)]} />], ["163:84357", <Aiutanti aiutanti={[ai("Controlla i tipi", true, false, 8000)]} aperto />],
    ["163:84371", <Aiutanti aiutanti={[ai("Lancia le prove", true, true, 41_000)]} />]]} />,
  "163-84565": () => <Righe f={elenco} posti={[["163:84383", <Gruppo g={DODICI} />], ["163:84389", <Gruppo g={g(CINQUE, { durata: 48_000, errori: [] })} aperto riga={2} />],
    ["163:84444", <Gruppo g={ERRORE} />], ["163:84453", <Gruppo g={{ ...DODICI, strumenti: [...CINQUE, ...ALTRI] }} aperto riga={2} />]]} />,
};

export const scene = fogli;
