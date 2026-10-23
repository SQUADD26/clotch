// figma: 101-32359 — Impostazioni · Sessioni archiviate; vuota: 101-32550.
// shortcut: non c'è ancora un elenco delle archiviate né un comando per ripristinarle (BLOCCATO in #351): fuori dalla prova
// la sezione mostra il vuoto disegnato.
import { useState } from "react";
import { Bottone } from "../base/Bottone";
import { Campo } from "../base/Campo";
import { Gruppo, Pagina, Riga, VuotoLista } from "./controlli";
import { ARCHIVIATE_PROVA, inParita, prova } from "./prova";

export default function Archiviate() {
  const tutte = inParita && !prova?.archiviateVuote ? ARCHIVIATE_PROVA : [];
  const [cerca, setCerca] = useState("");
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
            <Riga key={s.titolo} etichetta={s.titolo} descrizione={s.dove} azione>
              <Bottone tipo="secondario" disabled>Ripristina</Bottone>
            </Riga>
          ))}
      </Gruppo>
    </Pagina>
  );
}
