// figma: 101-17363 — Impostazioni · Notifiche. «Silenzio» ferma solo le notifiche dell'app (non è il Non disturbare di Friday).
import { Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
import { imposta, useImpostazioni, type Chiave } from "./stato";

const AVVISI: [Chiave, string, string][] = [
  ["avvisoAttesa", "Sessione in attesa di te", "Quando chiede un permesso o ti fa una domanda"],
  ["avvisoFinita", "Sessione finita", "Quando chiude il turno"],
  ["avvisoErrori", "Errori e blocchi", "Comando non riuscito, regola che blocca, sessione che non risponde"],
  ["avvisoLimite", "Limite di uso", "Quando un account si ferma e quando riparte"],
];

export default function Notifiche() {
  const v = useImpostazioni();
  return (
    <Pagina titolo="Notifiche">
      <Gruppo>
        {AVVISI.map(([k, etichetta, descrizione]) => (
          <Riga key={k} etichetta={etichetta} descrizione={descrizione}>
            <Interruttore etichetta={etichetta} acceso={v[k] === true} onCambia={(x) => imposta(k, x)} />
          </Riga>
        ))}
        {/* le opzioni di Suono e Silenzio non sono ancora disegnate (BLOCCATO in #351) */}
        <Riga etichetta="Suono" descrizione="Per le sessioni in attesa di te"><Scelta etichetta="Suono" valore={v.suono} /></Riga>
        <Riga etichetta="Silenzio" descrizione="Niente notifiche in queste ore"><Scelta etichetta="Silenzio" valore={v.silenzio} /></Riga>
      </Gruppo>
    </Pagina>
  );
}
