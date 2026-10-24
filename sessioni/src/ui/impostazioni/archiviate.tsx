// figma: 101-32359 — Impostazioni · Sessioni archiviate; vuota: 101-32550.
import { useEffect, useState } from "react";
import type { Archiviata } from "../../tipi";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { Campo } from "../base/Campo";
import { testoEsito } from "./clotch-ai";
import { Gruppo, Pagina, Riga, VuotoLista } from "./controlli";

export default function Archiviate() {
  const [tutte, setTutte] = useState<Archiviata[]>([]);
  useEffect(() => { window.impostazioni.archiviate().then(setTutte, () => {}); }, []);
  const [cerca, setCerca] = useState("");
  const ripristina = async (id: string) => {
    const e = await window.clotchAi.comando("ripristina", { chat: id }).catch(() => null);
    if (e?.esito === "ok") return setTutte((t) => t.filter((s) => s.id !== id));
    // il contratto v1 non elenca i comandi del motore: uno vecchio risponde «comando sconosciuto», che qui diventa una frase da leggere
    const vecchio = e?.esito === "rifiutato" && /sconosciuto/i.test(e.testo);
    avvisa({ tipo: "errore", messaggio: vecchio ? "Ripristino non disponibile: aggiorna clotch AI" : e ? testoEsito(e) : "Comando non riuscito" });
  };
  const viste = tutte.filter((s) => `${s.titolo} ${s.dove}`.toLowerCase().includes(cerca.trim().toLowerCase()));
  return (
    <Pagina titolo="Sessioni archiviate">
      {tutte.length > 0 && (
        <Campo grande tasto="esc" placeholder="Cerca sessioni archiviate" value={cerca}
          onChange={(e) => setCerca(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setCerca("")} />
      )}
      <Gruppo>
        {tutte.length === 0
          ? <VuotoLista titolo="Nessuna sessione archiviata" corpo="Archivia una sessione dal suo menu «…»: la ritrovi qui." />
          : viste.map((s) => (
            <Riga key={s.id} etichetta={s.titolo} descrizione={s.dove} azione>
              <Bottone tipo="secondario" onClick={() => ripristina(s.id)}>Ripristina</Bottone>
            </Riga>
          ))}
      </Gruppo>
    </Pagina>
  );
}
