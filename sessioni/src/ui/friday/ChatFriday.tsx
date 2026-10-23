// figma: 101-42000 — chat Friday: Friday spenta (101-42000), riavvio in corso (101-42245), avvio (101-41834); voce e prima apertura: 101-36642, 36832, 37055, 37278, 37492.
// Il filo della chat Friday (101-16432) e la casella sono della chat (#349): qui lo stato di Friday tra il filo e la casella.
import { Bottone } from "../base/Bottone";
import { CasellaFriday, FiloFriday } from "../chat";
import { useVociFriday } from "../chat/FiloFriday";
import { avviaFriday, useAvvio, useRegistro } from "./dati";
import { orario } from "./formato";
import { Permessi, usePermessi } from "./Permessi";
import { AvvisoRosso } from "./Pezzi";
import { PrimaApertura } from "./PrimaApertura";
import { AvvisoMicrofono, BarraVoce, useVoce } from "./Voce";
import { statoFriday } from "./vista";

export function ChatFriday() {
  const { dati: r } = useRegistro();
  const avvio = useAvvio();
  const st = r ? statoFriday(r, Date.now()) : null;
  const spenta = !avvio && st?.stato === "spenta";
  const voce = useVoce();
  const permessi = usePermessi();
  const vuota = useVociFriday().length === 0 && !permessi.length;
  const parla = voce.stato === "ascolta" || voce.stato === "parla" ? voce.stato : null;
  return (
    <>
      {/* chat vuota (101-36642) solo a registro letto: prima non si sa se è vuota */}
      {vuota && r ? <PrimaApertura /> : <FiloFriday>{permessi.length > 0 && <Permessi permessi={permessi} />}</FiloFriday>}
      {(avvio === "riavvio" || spenta) && <div className="vista-friday chat-friday">
        {avvio === "riavvio" && <AvvisoRosso titolo="Riavvio clotch AI" corpo="Riprendo le sessioni e gli avvisi da dove erano." />}
        {!avvio && st?.stato === "spenta" && (
          <>
            <AvvisoRosso titolo={st.da ? `clotch AI si è chiusa alle ${orario(st.da)}` : "clotch AI si è chiusa"} corpo="L’app prova a riaprirla. Se non riparte, riavviala tu." />
            <div className="riga-f"><Bottone tipo="secondario" onClick={() => avviaFriday("riavvio")}>Riavvia clotch AI</Bottone></div>
          </>
        )}
      </div>}
      {voce.stato === "mic-no" && <AvvisoMicrofono />}
      {parla ? <BarraVoce stato={parla} parlaApp={voce.parlaApp} /> : <CasellaFriday spenta={spenta} />}
    </>
  );
}
