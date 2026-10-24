// figma: 148-62026 — bottone account in fondo alla barra (#478): account in uso con le quote 5 ore e 7 giorni; primo menu 148:62191
// (uso attuale + «Cambia account»), secondo menu 148:62379 (gli altri account), 90 % 148:62621, cambio non disponibile 148:62813.
import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import type { Registro } from "../../clotch-ai";
import type { QuotaUso } from "../../tipi";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { useTastiMenu } from "../base/tastiera-menu";
import { Sovrapposto } from "../base/Sovrapposto";
import { numero } from "../base/token";
import { comanda } from "../chat/clotch-ai";
import { accountScelto, conto, iniziali, livello, nome, trova, useCorrente, useOra, useQuote, type Livello } from "./account-dati";
import { useProfilo } from "./Righe";
import "./account.css";

/** Dati fissi della scena di prova (`npm run parita`): ora, quote, account previsto, menu aperto (1 = uso, 2 = anche gli altri account), riga col passaggio. */
export interface ProvaAccount { ora: number; quote: QuotaUso[]; previsto: string | null; menu?: 0 | 1 | 2; passaggio?: string }
interface Props { /** Account distinti nell'elenco delle sessioni. */ conta: number; chat: string | null; registro: Registro | null; daDisco?: string; /** Vista Nuova sessione: la sola in cui si chiede `account_previsto`. */ nuova?: boolean; prova?: ProvaAccount; onAltro(e: MouseEvent): void; /** Il piede sta per aprire il menu uso: la barra chiude gli altri sovrapposti suoi (uno solo in cima). */ onApre?(): void }

// un colore per account, nell'ordine del feed (come la legenda di Uso nelle impostazioni)
const COLORI = ["blu", "arancione", "viola", "verde"];
const colore = (i: number): CSSProperties => ({ background: `var(--colore-sessione-${COLORI[i % COLORI.length]})` });
// senza dato lo dice (#965); oltre il 100 % il testo si ferma a 100, la barra già lo fa
const pc = (u: number | null | undefined, nd = " non disponibile") => (u == null ? nd : ` ${Math.min(u, 100)}%`);
/** Finestra stretta: il secondo menu non sta accanto al primo senza coprirlo (#966). */
const useStretto = () => {
  const [s, setS] = useState(innerWidth < 700);
  useEffect(() => { const f = () => setS(innerWidth < 700); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  return s;
};

/** Un uso senza dato (null) non ha barra: mai una barra a 0. */
function Barra({ usato }: { usato: number | null | undefined }) {
  return usato == null ? null : <div className="barra-account"><div className={`pieno l-${livello(usato)}`} style={{ width: `${Math.min(usato, 100)}%` }} /></div>;
}

function Blocco({ etichetta, usato, fine, ora }: { etichetta: string; usato?: number | null; fine?: number | null; ora: number }) {
  const resta = conto(fine, ora);
  return (
    <div className="blocco-uso">
      <div className="testata"><span className="t-base">{etichetta}</span><span className={`t-sm ${livello(usato) === "pieno" ? "errore" : "secondario"}`}>{usato == null ? "Non disponibile" : usato > 100 ? "Oltre il limite" : `${usato}% usato`}</span></div>
      <Barra usato={usato} />
      {resta && <span className="t-sm secondario">Riparte tra {resta}</span>}
    </div>
  );
}

function Mini({ etichetta, usato }: { etichetta: string; usato: number | null | undefined }) {
  return <span className="mini"><span className={`t-xs ${livello(usato) === "pieno" ? "errore" : "secondario"}`}>{etichetta + pc(usato, " n/d")}</span><Barra usato={usato} /></span>;
}

/** «5 ore quasi finite»: la finestra più piena tra le due, se da 90 % in su. */
function avviso(q: QuotaUso): string | null {
  const [e, u] = [q.cinque, q.sette].map(livello) as [Livello, Livello];
  const [cosa, l] = e !== "ok" ? ["5 ore", e] : u !== "ok" ? ["7 giorni", u] : ["", "ok"];
  return !cosa ? null : l === "pieno" ? `${cosa} ${cosa === "5 ore" ? "finite" : "finiti"}` : `${cosa} quasi ${cosa === "5 ore" ? "finite" : "finiti"}`;
}

export function AccountBarra({ conta, chat, registro, daDisco, nuova, prova, onAltro, onApre }: Props) {
  const utente = useProfilo().nome.split(" ")[0];
  const ora = useOra(prova?.ora);
  const quote = useQuote(prova?.quote) ?? [];
  const cor = useCorrente(chat, registro, daDisco, prova?.previsto, nuova);
  const [menu, setMenu] = useState<0 | 1 | 2>(prova?.menu ?? 0);
  const [piede, setPiede] = useState<HTMLDivElement | null>(null);
  // il secondo menu si appoggia al primo, alla sua destra, coi fondi allineati
  const [primo, setPrimo] = useState<HTMLDivElement | null>(null);
  const [secondo, setSecondo] = useState<HTMLDivElement | null>(null);
  const stretto = useStretto();
  useTastiMenu(primo, () => setMenu(0));
  useTastiMenu(secondo, () => setMenu(0));

  // senza sessione l'account è quello previsto (o il primo del feed se il motore non risponde)
  const q = trova(quote, cor.chiave) ?? (cor.motore === null ? quote[0] : undefined);
  const titolo = q?.account ?? (cor.chiave ? nome(cor.chiave) : utente || "Account");
  const colori = Math.max(0, quote.findIndex((x) => x === q));
  const cambia = cor.motore !== false && quote.length > 1;
  const passa = (x: QuotaUso) => {
    setMenu(0);
    const email = x.email ?? x.account;
    if (cor.motore && chat) void comanda("riprendi_altrove", { chat, account: email });
    else accountScelto.imposta(email);
  };
  const avvisoLimite = q && avviso(q);

  return (
    <div className="account-barra">
      <div ref={setPiede} className={`piede-account ${menu ? "aperto" : ""}`} onClick={() => { if (!menu) onApre?.(); setMenu(menu ? 0 : 1); }}>
        <div className="riga-account">
          <button type="button" className="apri" aria-haspopup="menu" aria-expanded={menu > 0}>
            <span className="avatar" style={colore(colori)}><span className="t-xs medio">{iniziali(titolo)}</span></span>
            <span className="testi">
              <span className="t-base">{titolo}</span>
              <span className="t-xs secondario">{[utente, conta || quote.length ? `${quote.length || conta} account` : ""].filter(Boolean).join(", ")}</span>
            </span>
            {cambia && <span className="cambia"><Icona nome="giu" /></span>}
          </button>
          <BottoneIcona icona="altro" etichetta="Impostazioni" onClick={(e) => { e.stopPropagation(); setMenu(0); onAltro(e); }} />
        </div>
        {!q && <span className="t-xs secondario">Uso non disponibile</span>}
        {q && (["5 ore", "7 giorni"] as const).map((e, i) => {
          const usato = i ? q.sette : q.cinque, resta = conto(i ? q.setteFine : q.cinqueFine, ora);
          return (
            <div key={e} className="uso-piede">
              <div className="testata t-xs secondario"><span className={livello(usato) === "pieno" ? "errore" : ""}>{e + pc(usato)}</span><span>{resta}</span></div>
              <Barra usato={usato} />
            </div>
          );
        })}
      </div>

      {menu > 0 && piede && !(stretto && menu === 2) && (
        <Sovrapposto ancora={piede} lato="sopra" scarto={numero("spazio-2")} className="menu-account" role="menu" rif={setPrimo} onChiudi={() => setMenu(0)}>
          {q
            ? <div className="uso-attuale">
                <Blocco etichetta="5 ore" usato={q.cinque} fine={q.cinqueFine} ora={ora} />
                <Blocco etichetta="7 giorni" usato={q.sette} fine={q.setteFine} ora={ora} />
                {avvisoLimite && <div className="avviso-limite"><Icona nome="avviso" /><span className="t-sm">{avvisoLimite}</span></div>}
              </div>
            : <div className="motivo"><Icona nome="info" /><span className="t-sm secondario">Non riesco a leggere l’uso di questo account. Riprova tra poco.</span></div>}
          <div className="linea" />
          {cor.motore === false
            ? <div className="motivo"><Icona nome="info" /><span className="t-sm secondario">Sessione avviata fuori da clotch: l’account non si cambia.</span></div>
            : <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={menu === 2} className={`voce ${menu === 2 ? "scelta" : ""}`} onClick={() => setMenu(menu === 2 ? 1 : 2)}>
                <Icona nome="persona" /><span className="t-sm testo">Cambia account</span><Icona nome="destra" />
              </button>}
        </Sovrapposto>
      )}

      {menu === 2 && cambia && (stretto ? piede : primo) && (
        <Sovrapposto ancora={stretto ? piede : primo} lato={stretto ? "sopra" : "destra"} fine={!stretto} scarto={numero("spazio-2")} className="menu-account secondo" role="menu" rif={setSecondo} onChiudi={() => setMenu(1)}>
          <div className="titolo-menu t-sm secondario">Cambia account</div>
          {quote.map((x, i) => x !== q && (
            <button key={x.account} type="button" role="menuitem" className={`riga-altro ${prova?.passaggio === x.account ? "passaggio" : ""}`} onClick={() => passa(x)}>
              <span className="avatar piccolo" style={colore(i)}><span className="t-xs medio">{iniziali(x.account)}</span></span>
              <span className="testi">
                <span className="nome">
                  <span className="t-sm testo">{x.account}</span>
                  {livello(x.cinque) === "pieno" ? <span className="t-xs errore">Riparte tra {conto(x.cinqueFine, ora)}</span> : <span className="passa t-xs secondario">Passa</span>}
                </span>
                <span className="barre"><Mini etichetta="5 ore" usato={x.cinque} /><Mini etichetta="7 giorni" usato={x.sette} /></span>
              </span>
            </button>
          ))}
          <div className="linea" />
          <div className="nota t-xs secondario">{cor.motore ? "La sessione riprende sull’account scelto." : "La sessione parte con l’account scelto."}</div>
        </Sovrapposto>
      )}
    </div>
  );
}
