// figma: 119-57552 — «Novità della versione»: una voce per riga con la spunta di successo. Si apre dal menu del profilo e da Impostazioni · Info.
import { Bottone } from "../base/Bottone";
import { Dialogo } from "../base/Dialogo";
import { chiudiDialogo, type DatiDialoghi } from "../base/dialoghi";
import { Icona } from "../base/Icona";

export function DialogoNovita({ versione, novita }: DatiDialoghi["novita"]) {
  return (
    <Dialogo titolo={`Novità della versione ${versione}`} corpo={novita.data} onChiudi={chiudiDialogo} bottoni={<Bottone onClick={chiudiDialogo}>Chiudi</Bottone>}>
      <ul className="novita">
        {novita.voci.map((x) => <li key={x} className="t-sm"><Icona nome="spunta" colore="successo" />{x}</li>)}
      </ul>
    </Dialogo>
  );
}
