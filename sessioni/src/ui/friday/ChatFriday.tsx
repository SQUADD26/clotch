// figma: 101-42000 — chat Friday: Friday spenta (101-42000), riavvio in corso (101-42245), avvio (101-41834).
// Il filo della chat Friday (101-16432) e la casella sono della chat (#349): qui lo stato di Friday tra il filo e la casella.
import { Bottone } from "../base/Bottone";
import { CasellaFriday, FiloFriday } from "../chat";
import { avviaFriday, useAvvio, useRegistro } from "./dati";
import { orario } from "./formato";
import { AvvisoRosso } from "./Pezzi";
import { statoFriday } from "./vista";

export function ChatFriday() {
  const { dati: r } = useRegistro();
  const avvio = useAvvio();
  const st = r ? statoFriday(r, Date.now()) : null;
  const spenta = !avvio && st?.stato === "spenta";
  return (
    <>
      <FiloFriday />
      {(avvio === "riavvio" || spenta) && <div className="vista-friday chat-friday">
        {avvio === "riavvio" && <AvvisoRosso titolo="Riavvio Friday" corpo="Riprendo le sessioni e gli avvisi da dove erano." />}
        {!avvio && st?.stato === "spenta" && (
          <>
            <AvvisoRosso titolo={st.da ? `Friday si è chiusa alle ${orario(st.da)}` : "Friday si è chiusa"} corpo="L’app prova a riaprirla. Se non riparte, riavviala tu." />
            <div className="riga-f"><Bottone tipo="secondario" onClick={() => avviaFriday("riavvio")}>Riavvia Friday</Bottone></div>
          </>
        )}
      </div>}
      <CasellaFriday spenta={spenta} />
    </>
  );
}
