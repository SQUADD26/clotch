// figma: 101-17363 — Impostazioni · Notifiche; «Scegli le ore…» apre il dialogo del silenzio (149-66688, 149-66511 con l'orario scelto). «Silenzio» ferma solo le notifiche dell'app (non è il Non disturbare di clotch AI).
import { useEffect } from "react";
import { apriDialogo } from "../base/dialoghi";
import { Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
import { prova } from "./prova";
import { imposta, useImpostazioni, type Chiave } from "./stato";

const AVVISI: [Chiave, string, string][] = [
  ["avvisoAttesa", "Sessione in attesa di te", "Quando chiede un permesso o ti fa una domanda"],
  ["avvisoFinita", "Sessione finita", "Quando chiude il turno"],
  ["avvisoErrori", "Errori e blocchi", "Comando non riuscito, regola che blocca, sessione che non risponde"],
  ["avvisoLimite", "Limite di uso", "Quando un account si ferma e quando riparte"],
];

const SUONI = ["Vetro", "Campanello", "Pop", "Nessun suono"]; // 119:56546
const ORE = "Scegli le ore…";
const SILENZI = ["Mai", "22:00–8:00", "23:00–7:00", ORE]; // 119:56715

// «Scegli le ore…»: il dialogo «Quando non vuoi ricevere notifiche?» (149-66688)
const scegliOre = (attuali: string) => apriDialogo("ore", { valore: attuali, salva: (ore) => imposta("silenzio", ore) });

export default function Notifiche() {
  const v = useImpostazioni();
  useEffect(() => { if (prova?.ore) apriDialogo("ore", { ...prova.ore, salva() {} }); }, []); // 149-66688, 149-66904, 149-67120: il dialogo già aperto
  return (
    <Pagina titolo="Notifiche">
      <Gruppo>
        {AVVISI.map(([k, etichetta, descrizione]) => (
          <Riga key={k} etichetta={etichetta} descrizione={descrizione}>
            <Interruttore etichetta={etichetta} acceso={v[k] === true} onCambia={(x) => imposta(k, x)} />
          </Riga>
        ))}
        <Riga etichetta="Suono" descrizione="Per le sessioni in attesa di te"><Scelta etichetta="Suono" valore={v.suono} voci={SUONI} onScegli={(x) => { imposta("suono", x); void window.impostazioni.provaSuono(x); }} /></Riga>
        <Riga etichetta="Silenzio" descrizione="Niente notifiche in queste ore"><Scelta etichetta="Silenzio" valore={v.silenzio} voci={SILENZI.includes(v.silenzio) ? SILENZI : [...SILENZI.slice(0, -1), v.silenzio, ORE]}
          onScegli={(x) => (x === ORE ? scegliOre(v.silenzio) : imposta("silenzio", x))} /></Riga>
      </Gruppo>
    </Pagina>
  );
}
