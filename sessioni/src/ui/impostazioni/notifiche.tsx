// figma: 101-17363 — Impostazioni · Notifiche. «Silenzio» ferma solo le notifiche dell'app (non è il Non disturbare di clotch AI).
import { avvisa } from "../base/Avvisi";
import { apriDialogo } from "../base/dialoghi";
import { Gruppo, Interruttore, Pagina, Riga, Scelta } from "./controlli";
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

/** «22-8», «9.30–17» -> «22:00–8:00»; un testo che non è un intervallo di ore (o con inizio = fine) è null. */
export function oreValide(testo: string): string | null {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*[–-]\s*(\d{1,2})(?:[:.](\d{2}))?$/.exec(testo.trim());
  if (!m) return null;
  const [h1, m1, h2, m2] = [+m[1], +(m[2] ?? 0), +m[3], +(m[4] ?? 0)];
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59 || (h1 === h2 && m1 === m2)) return null;
  const f = (h: number, mm: number) => `${h}:${String(mm).padStart(2, "0")}`;
  return `${f(h1, m1)}–${f(h2, m2)}`;
}

// «Scegli le ore…»: il dialogo con il campo è quello di «Rinomina» (nessun selettore di ore è disegnato)
const scegliOre = (attuali: string) => apriDialogo("rinomina", {
  titolo: "Scegli le ore", valore: SILENZI.includes(attuali) ? "" : attuali, nota: "Scrivi inizio e fine, per esempio 22:00–8:00.",
  salva: (testo) => {
    const ore = oreValide(testo);
    if (ore) imposta("silenzio", ore);
    else avvisa({ tipo: "errore", messaggio: "Ore non valide. Scrivi per esempio 22:00–8:00." });
  },
});

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
        <Riga etichetta="Suono" descrizione="Per le sessioni in attesa di te"><Scelta etichetta="Suono" valore={v.suono} voci={SUONI} onScegli={(x) => imposta("suono", x)} /></Riga>
        <Riga etichetta="Silenzio" descrizione="Niente notifiche in queste ore"><Scelta etichetta="Silenzio" valore={v.silenzio} voci={SILENZI.includes(v.silenzio) ? SILENZI : [...SILENZI.slice(0, -1), v.silenzio, ORE]}
          onScegli={(x) => (x === ORE ? scegliOre(v.silenzio) : imposta("silenzio", x))} /></Riga>
      </Gruppo>
    </Pagina>
  );
}
