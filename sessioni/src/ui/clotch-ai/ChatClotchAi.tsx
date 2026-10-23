// figma: 101-42000 — chat clotch AI: clotch AI spenta (101-42000), riavvio in corso (101-42245), avvio (101-41834).
// Il filo della chat clotch AI (101-16432) e la casella sono della chat (#349): qui lo stato di clotch AI tra il filo e la casella.
import { Bottone } from "../base/Bottone";
import { CasellaClotchAi, FiloClotchAi } from "../chat";
import { avviaClotchAi, useAvvio, useRegistro } from "./dati";
import { orario } from "./formato";
import { AvvisoRosso } from "./Pezzi";
import { statoClotchAi } from "./vista";

export function ChatClotchAi() {
  const { dati: r } = useRegistro();
  const avvio = useAvvio();
  const st = r ? statoClotchAi(r, Date.now()) : null;
  const spenta = !avvio && st?.stato === "spenta";
  return (
    <>
      <FiloClotchAi />
      {(avvio === "riavvio" || spenta) && <div className="vista-clotch-ai chat-clotch-ai">
        {avvio === "riavvio" && <AvvisoRosso titolo="Riavvio clotch AI" corpo="Riprendo le sessioni e gli avvisi da dove erano." />}
        {!avvio && st?.stato === "spenta" && (
          <>
            <AvvisoRosso titolo={st.da ? `clotch AI si è chiusa alle ${orario(st.da)}` : "clotch AI si è chiusa"} corpo="L’app prova a riaprirla. Se non riparte, riavviala tu." />
            <div className="riga-f"><Bottone tipo="secondario" onClick={() => avviaClotchAi("riavvio")}>Riavvia clotch AI</Bottone></div>
          </>
        )}
      </div>}
      <CasellaClotchAi spenta={spenta} />
    </>
  );
}
