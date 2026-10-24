// figma: 149-67470 — «Menu macchine SSH» 149:67469 (macchine, «Da Claude Desktop», «Aggiungi macchina…»); vuoto 149:67503; la base che non si toglie 149:69920 («Suggerimento» 149:69891).
// Le macchine arrivano dal motore (comando `macchine`): la tabella di base non si toglie dall'app, le altre hanno il cestino al passaggio.
import type { Macchina, Proposta } from "../../macchine-tipi";
import { Icona } from "../base/Icona";
import type { Ambiente } from "./avvio";
import type { ElencoMacchine } from "./usaMacchine";
import "../base/suggerimento.css";
import "./macchine.css";

const Separatore = () => <div className="separatore" role="separator"><div className="linea" /></div>;

/** `mostraBase`: il nome della macchina di base con il suggerimento sempre aperto (scena di prova 149:69920). */
export function PannelloSsh({ mac, ambiente, mostraBase = null, onScegli, onAggiungi, onTogli }: {
  mac: ElencoMacchine; ambiente: Ambiente; mostraBase?: string | null; onScegli(a: Ambiente): void; onAggiungi(p?: Proposta): void; onTogli(m: Macchina): void;
}) {
  const remote = mac.macchine.filter((m) => !m.locale);
  const vuoto = !remote.length && !mac.proposte.length;
  return (
    <>
      {vuoto && (
        <div className="vuoto-ssh">
          <span className="titolo">{mac.carica ? "Cercando le macchine…" : mac.errore ? "Macchine non raggiungibili" : "Nessuna macchina SSH"}</span>
          <span className="corpo">{mac.errore ?? "Aggiungi una macchina per aprirci sessioni."}</span>
        </div>
      )}
      {remote.map((m) => {
        const base = m.fonte === "tabella", daFinire = m.stato === "da_completare";
        return (
          <div key={m.nome} role="menuitem" tabIndex={0} className={`voce riga-macchina${mostraBase === m.nome ? " mostra" : ""}`}
            aria-label={`${m.nome}, ${daFinire ? "da completare" : `${m.utente}@${m.nome}`}`} // senza il suggerimento della base nel nome
            onClick={() => onScegli({ tipo: "ssh", host: m.nome })}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onScegli({ tipo: "ssh", host: m.nome }); } }}>
            {daFinire ? <Icona nome="avviso" colore="lavoro" /> : <Icona nome="computer" />}
            <span className="etichetta">{m.nome}</span>
            {daFinire ? <span className="valore da-completare">Da completare</span> : <span className="valore">{m.utente}@{m.nome}</span>}
            {ambiente.tipo === "ssh" && ambiente.host === m.nome && <Icona nome="spunta" colore="primaria" />}
            {!base && <button type="button" className="togli" aria-label={`Rimuovi ${m.nome}`} onClick={(e) => { e.stopPropagation(); onTogli(m); }}><Icona nome="cestino" /></button>}
            {base && <span className="tooltip" role="tooltip">È la macchina di base: non si rimuove.</span>}
          </div>
        );
      })}
      {!!mac.proposte.length && (
        <>
          {!!remote.length && <Separatore />}
          <div className="titolo-gruppo">Da Claude Desktop</div>
          {mac.proposte.map((p) => (
            <button key={p.desktop_id} type="button" role="menuitem" className="voce" onClick={() => onAggiungi(p)}>
              <Icona nome="finestra" /><span className="etichetta">{p.nome}</span><span className="valore">{p.utente}@{p.nome}</span>
            </button>
          ))}
        </>
      )}
      {!vuoto && <Separatore />}
      <button type="button" role="menuitem" className="voce" onClick={() => onAggiungi()}><Icona nome="piu" /><span className="etichetta">Aggiungi macchina…</span></button>
    </>
  );
}
