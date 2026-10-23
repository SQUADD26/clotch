// figma: 101-42000 — chat Friday: Friday spenta (101-42000), riavvio in corso (101-42245), avvio (101-41834).
// Il filo della chat Friday (101-16432) e la casella sono della chat (#349): qui lo stato di Friday tra il filo e la casella.
import { useEffect } from "react";
import { Bottone, BottoneIcona } from "../base/Bottone";
import { useNavigazione } from "../base/navigazione";
import { CasellaFriday, FiloFriday } from "../chat";
import { CasellaVoce } from "../chat/CasellaVoce";
import { provaDi } from "../chat/testi";
import { useClotchAcceso } from "../pannello/Pillole";
import { avviaFriday, useAvvio, useRegistro } from "./dati";
import { orario } from "./formato";
import { AvvisoRosso } from "./Pezzi";
import { statoFriday } from "./vista";
import { dettaChiTocca, dettatura, useVoce } from "./voce";

export function ChatFriday() {
  const { dati: r } = useRegistro();
  const avvio = useAvvio();
  const st = r ? statoFriday(r, Date.now()) : null;
  const spenta = !avvio && st?.stato === "spenta";
  const voce = useVoce();
  const clotch = useClotchAcceso();
  const { sezione } = useNavigazione();
  // scena di prova 101:46701 e 101:46741: «dettatura:<testo>» parte col microfono aperto e quel testo
  useEffect(() => { const t = provaDi(sezione, "dettatura"); if (t !== null) dettatura.metti({ attiva: true, testo: t }); }, [sezione]);
  // ⌥Spazio apre e chiude il microfono; con Clotch acceso è il suo tasto globale e l'app non fa niente
  useEffect(() => {
    if (clotch) return;
    const premi = (e: KeyboardEvent) => { if (e.altKey && e.code === "Space" && !e.repeat) { e.preventDefault(); dettaChiTocca(false); } };
    addEventListener("keydown", premi);
    return () => removeEventListener("keydown", premi);
  }, [clotch]);
  return (
    <>
      <FiloFriday />
      {(avvio === "riavvio" || spenta) && <div className="vista-friday chat-friday">
        {avvio === "riavvio" && <AvvisoRosso titolo="Riavvio clotch AI" corpo="Riprendo le sessioni e gli avvisi da dove erano." />}
        {!avvio && st?.stato === "spenta" && (
          <>
            <AvvisoRosso titolo={st.da ? `clotch AI si è chiusa alle ${orario(st.da)}` : "clotch AI si è chiusa"} corpo="L’app prova a riaprirla. Se non riparte, riavviala tu." />
            <div className="riga-f"><Bottone tipo="secondario" onClick={() => avviaFriday("riavvio")}>Riavvia clotch AI</Bottone></div>
          </>
        )}
      </div>}
      {voce ? <CasellaVoce voce={voce} /> : (
        <CasellaFriday spenta={spenta} microfono={<BottoneIcona icona="microfono" etichetta="Detta" disabled={spenta} onClick={() => dettaChiTocca(clotch)} />} />
      )}
    </>
  );
}
