// figma: 149-67536 — «Aggiungi macchina»: «Chip proposta» e «Campo macchina» (149:67382, 149:67396); da proposta 149:67568, nome non valido 149:67600.
// Host, porta, utente, chiave (solo il percorso del file), nome e cartella: sono gli argomenti di `macchina_aggiungi` (contratto v1, sez. 3).
import { useId } from "react";
import type { Proposta } from "../../macchine-tipi";
import { Icona } from "../base/Icona";
import { numero } from "../base/token";
import { Bottone } from "../base/Bottone";
import { nomeValido } from "./macchine";
import "./macchine.css";

export interface ValoriMacchina { host: string; porta: string; utente: string; chiave: string; nome: string; cartella: string; desktopId: string | null }
export const VUOTI: ValoriMacchina = { host: "", porta: "", utente: "", chiave: "", nome: "", cartella: "", desktopId: null };

/** I campi che il motore vuole, o il perché non vanno: `host` e `cartella` (assoluta) servono sempre, il nome ha la sua regola. */
export const mancano = (v: ValoriMacchina) => ({ host: !v.host.trim(), nome: !nomeValido(v.nome), cartella: !v.cartella.trim().startsWith("/") });

/** Il form riempito da una connessione di Claude Desktop; la cartella la propone solo se è vuota. */
export const daProposta = (p: Proposta, v: ValoriMacchina): ValoriMacchina => ({
  ...v, host: p.host, porta: String(p.porta), utente: p.utente, chiave: p.chiave ?? "", nome: p.nome, desktopId: p.desktop_id,
  cartella: v.cartella || (p.utente ? `/home/${p.utente}/progetti` : ""),
});

/** `onInvio`: Invio nel campo preme il bottone predefinito del dialogo (HIG, Sheets). */
function Campo({ etichetta, valore, segnaposto, errore = false, messaggio, larghezza, sola = false, onCambia, onInvio }: {
  etichetta: string; valore: string; segnaposto: string; errore?: boolean; messaggio?: string; larghezza?: number; sola?: boolean; onCambia?(v: string): void; onInvio?(): void;
}) {
  const id = useId();
  return (
    <label className="campo-macchina" style={larghezza ? { width: larghezza } : undefined}>
      <span className="etichetta-campo">{etichetta}</span>
      <input className={`casella-macchina${errore ? " errore" : ""}`} value={valore} placeholder={segnaposto} readOnly={sola} aria-invalid={errore || undefined} aria-describedby={messaggio ? id : undefined}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && onInvio) { e.preventDefault(); onInvio(); } }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => onCambia?.(e.target.value)} />
      {messaggio && <span id={id} className="messaggio-campo">{messaggio}</span>}
    </label>
  );
}

export function FormMacchina({ v, proposte, provato, onCambia, onProposta, onChiave, onInvio }: {
  v: ValoriMacchina; proposte: Proposta[]; provato: boolean; onCambia(p: Partial<ValoriMacchina>): void; onProposta(p: Proposta): void; onChiave(): void; onInvio(): void;
}) {
  const m = mancano(v);
  const nomeErrore = v.nome ? m.nome : provato && m.nome;
  return (
    <>
      {!!proposte.length && (
        <div className="proposte-macchina">
          <span className="titolo-proposte">Da Claude Desktop</span>
          <div className="chip-proposte">
            {proposte.map((p) => {
              const scelta = v.desktopId === p.desktop_id;
              return (
                <button key={p.desktop_id} type="button" className={`chip-proposta${scelta ? " scelta" : ""}`} aria-pressed={scelta} onClick={() => onProposta(p)}>
                  <Icona nome={scelta ? "spunta" : "finestra"} />{p.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="campi-macchina">
        <div className="riga-campi">
          <div className="campo-largo"><Campo etichetta="Indirizzo" valore={v.host} segnaposto="server.example.net" errore={provato && m.host} messaggio={provato && m.host ? "Scrivi l’indirizzo della macchina." : undefined} onCambia={(host) => onCambia({ host })} onInvio={onInvio} /></div>
          <Campo etichetta="Porta" valore={v.porta} segnaposto="22" larghezza={numero("misura-campo-porta")} onCambia={(porta) => onCambia({ porta: porta.replace(/\D/g, "").slice(0, 5) })} onInvio={onInvio} />
        </div>
        <Campo etichetta="Utente" valore={v.utente} segnaposto="utente" onCambia={(utente) => onCambia({ utente })} onInvio={onInvio} />
        <div className="riga-campi allinea-fondo">
          <div className="campo-largo"><Campo etichetta="Chiave di accesso" valore={v.chiave} segnaposto="Nessun file scelto" sola /></div>
          <Bottone tipo="secondario" onClick={onChiave}>Scegli file</Bottone>
        </div>
        <div className="riga-campi">
          <div className="campo-largo"><Campo etichetta="Nome" valore={v.nome} segnaposto="nome-macchina" errore={nomeErrore} messaggio={nomeErrore ? "Usa minuscole, numeri e trattini (massimo 32)." : undefined} onCambia={(nome) => onCambia({ nome })} onInvio={onInvio} /></div>
          <div className="campo-largo"><Campo etichetta="Cartella" valore={v.cartella} segnaposto="/home/utente/progetti" errore={provato && m.cartella} messaggio={provato && m.cartella ? "Scrivi il percorso completo." : undefined} onCambia={(cartella) => onCambia({ cartella })} onInvio={onInvio} /></div>
        </div>
      </div>
    </>
  );
}
