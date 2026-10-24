// figma: 101-14849 — «Messaggio in coda» 101:13488, «invia ora» 101:43945; con più voci della soglia la coda scorre e il conto resta sopra (#652).
import type { PreferenzeSessione } from "../../tipi";
import { BottoneIcona } from "../base/Bottone";
import { Suggerimento } from "../base/Suggerimento";
import { numero } from "../base/token";
import type { VoceCoda } from "./Casella";
import { comanda } from "./clotch-ai";
import { argsManda, quanti } from "./testi";

const RIGHE_VISIBILI = 4;

/** Manda subito una voce della coda (interrompe la sessione) e la toglie; vale per il bottone sulla riga e per ↵ a casella vuota. */
export const mandaOra = async (chat: string, v: VoceCoda, preferenza: string, attuale: string | null, pref?: PreferenzeSessione) => {
  if (await comanda("manda", argsManda(chat, v.testo, "subito", preferenza, attuale, pref))) await comanda("coda_togli", { chat, voce: v.voce });
};

export function Coda({ voci, modifica, onModifica, chat, suggerimento, attuale, preferenza, pref }: {
  voci: VoceCoda[]; modifica: string | null; onModifica(v: VoceCoda): void; chat: string; suggerimento: boolean; attuale: string | null; preferenza: string; pref?: PreferenzeSessione;
}) {
  const lunga = voci.length > RIGHE_VISIBILI, conto = quanti(voci.length, "messaggio in coda", "messaggi in coda");
  return (
    <div className={lunga ? "coda lunga" : "coda"}>
      {lunga && <span className="conto-coda">{conto}</span>}
      <div className="elenco-coda">
        {voci.map((v, i) => (
          <div key={v.voce} className={modifica === v.voce ? "messaggio-in-coda in-modifica" : "messaggio-in-coda"}>
            {i === 0 && !lunga && <span className="etichetta">{conto}</span>}
            <span className="testo">{v.testo}</span>
            <div className="azioni">
              <Suggerimento testo="Interrompi e manda ora" scorciatoia="↵" classe="suggerimento" lato="sopra" allinea="fine" scarto={numero("spazio-1")} forzato={suggerimento && i === 0}>
                <BottoneIcona icona="invia-ora" etichetta="Interrompi e manda ora" onClick={() => mandaOra(chat, v, preferenza, attuale, pref)} />
              </Suggerimento>
              <BottoneIcona icona="matita" etichetta="Modifica" onClick={() => onModifica(v)} />
              <BottoneIcona icona="chiudi" etichetta="Rimuovi" onClick={() => comanda("coda_togli", { chat, voce: v.voce })} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
