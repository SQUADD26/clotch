// figma: 101-10300 — Impostazioni · Sorgenti: da quali app si leggono le sessioni.
import { Gruppo, Interruttore, Pagina, Riga } from "./controlli";
import { imposta, useImpostazioni, type Chiave } from "./stato";

const SORGENTI: [Chiave, string, string][] = [
  ["sorgenteClaudeCode", "Claude Code", "Sessioni da terminale, da tutte le cartelle degli account"],
  ["sorgenteClaude", "Claude", "Sessioni dell’app Claude per Mac"],
  ["sorgenteCodex", "Codex", "Sessioni di Codex su questo computer"],
  ["sorgenteCursor", "Cursor", "Chat di Cursor. Si leggono, ma non ricevono messaggi"],
];

export default function Sorgenti() {
  const v = useImpostazioni();
  return (
    <Pagina titolo="Sorgenti">
      <Gruppo>
        {SORGENTI.map(([k, etichetta, descrizione]) => (
          <Riga key={k} etichetta={etichetta} descrizione={descrizione}>
            <Interruttore etichetta={etichetta} acceso={v[k] === true} onCambia={(x) => imposta(k, x)} />
          </Riga>
        ))}
      </Gruppo>
    </Pagina>
  );
}
