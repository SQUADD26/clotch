// figma: 101-45507 — «torna a Friday» nella barra del titolo: una sessione aperta da clotch AI riporta indietro, alla vista da cui si è partiti.
import { Icona } from "./Icona";
import { useNavigazione } from "./navigazione";
import "./torna.css";

export function TornaAFriday() {
  const n = useNavigazione();
  if (!n.daFriday) return null;
  return (
    <button type="button" className="torna-friday t-sm" onClick={n.indietro}>
      <Icona nome="indietro" />
      <Icona nome="scintille" colore="accento" />
      Torna a clotch AI
    </button>
  );
}
