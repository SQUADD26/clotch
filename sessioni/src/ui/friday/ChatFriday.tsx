// figma: 101-42000 — chat Friday: Friday spenta (101-42000), riavvio in corso (101-42245), avvio (101-41834); voce e prima apertura: 101-36642, 36832, 37055, 37278, 37492.
// Il filo della chat Friday (101-16432) e la casella sono della chat (#349): qui lo stato di Friday tra il filo e la casella.
import { useEffect } from "react";
import { Bottone, BottoneIcona } from "../base/Bottone";
import { useNavigazione } from "../base/navigazione";
import { CasellaFriday, FiloFriday } from "../chat";
import { useVociFriday } from "../chat/FiloFriday";
import { CasellaVoce } from "../chat/CasellaVoce";
import { provaDi } from "../chat/testi";
import { useClotchAcceso } from "../pannello/Pillole";
import { avviaFriday, useAvvio, useRegistro } from "./dati";
import { orario } from "./formato";
import { Permessi, usePermessi } from "./Permessi";
import { AvvisoRosso } from "./Pezzi";
import { PrimaApertura } from "./PrimaApertura";
import { AvvisoMicrofono, useVoce as useStatoVoce } from "./Voce";
import { statoFriday } from "./vista";
import { dettaChiTocca, dettatura, useVoce } from "./dettatura";

export function ChatFriday() {
  const { dati: r } = useRegistro();
  const avvio = useAvvio();
  const st = r ? statoFriday(r, Date.now()) : null;
  const spenta = !avvio && st?.stato === "spenta";
  const voce = useVoce(), microfonoAssente = useStatoVoce().stato === "mic-no";
  const permessi = usePermessi();
  const vuota = useVociFriday().length === 0 && !permessi.length;
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
      {microfonoAssente && <AvvisoMicrofono />}
      {voce ? <CasellaVoce voce={voce} /> : (
        <CasellaFriday spenta={spenta} microfono={<BottoneIcona icona="microfono" etichetta="Detta" disabled={spenta} onClick={() => dettaChiTocca(clotch)} />} />
      )}
    </>
  );
}
