// figma: 101-32359 — Impostazioni · Sessioni archiviate; vuota: 101-32550.
import { useEffect, useRef, useState } from "react";
import { avvisa } from "../base/Avvisi";
import { Bottone } from "../base/Bottone";
import { useChiamata } from "../base/dati";
import { Campo } from "../base/Campo";
import { testoEsito } from "./clotch-ai";
import { Carica, ErroreLista, Gruppo, Pagina, Riga, VuotoLista } from "./controlli";

const comando = (cmd: "archivia" | "ripristina", id: string) => window.clotchAi.comando(cmd, { chat: id }).catch(() => null);

/** Un esito non riuscito, come frase da leggere. */
function avvisaEsito(e: Awaited<ReturnType<typeof comando>>, cosa: string) {
  // il contratto v1 non elenca i comandi del motore: uno vecchio risponde «comando sconosciuto», che qui diventa una frase da leggere
  const vecchio = e?.esito === "rifiutato" && /sconosciuto/i.test(e.testo);
  avvisa({ tipo: "errore", messaggio: vecchio ? `${cosa} non disponibile: aggiorna clotch AI` : e ? testoEsito(e) : "Comando non riuscito" });
}

export default function Archiviate() {
  const lette = useChiamata(() => window.impostazioni.archiviate(), []);
  const [tolte, setTolte] = useState<string[]>([]); // ripristinate qui: escono dall'elenco, «Annulla» le rimette
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [cerca, setCerca] = useState("");
  // dopo un ripristino il fuoco va al «Ripristina» della riga che prende il posto di quella tolta (o della precedente), non al corpo della pagina
  const fuocoA = useRef<number | null>(null);
  useEffect(() => {
    if (fuocoA.current === null) return;
    const b = document.querySelectorAll<HTMLElement>(".pezzo-impostazioni .gruppo .riga button");
    (b[Math.min(fuocoA.current, b.length - 1)] ?? document.querySelector<HTMLElement>(".pezzo-impostazioni .contenuto-impostazioni input"))?.focus();
    fuocoA.current = null;
  }, [tolte]);
  const tutte = (lette.dati ?? []).filter((s) => !tolte.includes(s.id));
  const ripristina = async (id: string, i: number) => {
    setInCorso(id);
    const e = await comando("ripristina", id);
    setInCorso(null);
    if (e?.esito !== "ok") return avvisaEsito(e, "Ripristino");
    fuocoA.current = i;
    setTolte((t) => [...t, id]);
    avvisa({ tipo: "info", messaggio: "Sessione ripristinata", azione: { etichetta: "Annulla", fai: () => void comando("archivia", id).then((x) => (x?.esito === "ok" ? setTolte((t) => t.filter((y) => y !== id)) : avvisaEsito(x, "Archiviazione"))) } });
  };
  const q = cerca.trim();
  const viste = tutte.filter((s) => `${s.titolo} ${s.dove}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Pagina titolo="Sessioni archiviate">
      {tutte.length > 0 && (
        <Campo grande tasto="esc" placeholder="Cerca sessioni archiviate" value={cerca}
          onChange={(e) => setCerca(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setCerca("")} />
      )}
      <Gruppo>
        {lette.stato === "carica"
          ? <Carica testo="Caricando le sessioni archiviate…" />
          : lette.stato === "errore" && !lette.dati
          ? <ErroreLista titolo="Sessioni archiviate non lette" errore={lette.errore} riprova={lette.riprova} />
          : tutte.length === 0
          ? <VuotoLista titolo="Nessuna sessione archiviata" corpo="Archivia una sessione dal suo menu «…»: la ritrovi qui." />
          : viste.length === 0
          ? <VuotoLista titolo={`Nessun risultato per «${q}»`} corpo="Prova con altre parole." />
          : viste.map((s, i) => (
            <Riga key={s.id} etichetta={s.titolo} descrizione={s.dove} azione>
              <Bottone tipo="secondario" caricamento={inCorso === s.id} disabled={!!inCorso} aria-label={`Ripristina ${s.titolo}`} onClick={() => void ripristina(s.id, i)}>Ripristina</Bottone>
            </Riga>
          ))}
      </Gruppo>
    </Pagina>
  );
}
