// figma: 101-49067 — banda «via dal mac» sotto Regole: con Clotch (AFK acceso, 101:49347) e senza (101-49194, 101:49566).
// AFK: `afk.json` e `afk-fatto.jsonl` di Clotch, letti dal main (stato-app.ts) e mandati dentro il registro.
import type { Registro } from "../../clotch-ai";
import { Icona } from "../base/Icona";
import { plurale } from "../base/formato";
import { durata } from "../chat/testi";
import { acceso as clotchAcceso } from "../pannello/clotch";
import "./via.css";

/** Con AFK acceso la banda c'è in ogni vista. Senza Clotch c'è nella Casella, se qualcosa aspetta te: è lì che non sapere se sei via costa. */
export function ViaDalMac({ r, adesso, aspettano, inCasella }: { r: Registro | null; adesso: number; aspettano: number; inCasella: boolean }) {
  if (!r) return null;
  if (clotchAcceso(r, adesso)) {
    if (!r.afk) return null;
    const n = r.afk.avvisi;
    return (
      <div className="banda via">
        <div className="riga-banda">
          <Icona nome="luna" colore="accento" />
          <span className="titolo t-sm medio">Sei via dal Mac da {durata(Math.max(60_000, adesso - r.afk.da))}</span>
        </div>
        <span className="dettaglio t-xs secondario">
          {n === 0 ? "Nessun avviso da leggere al ritorno." : `clotch tiene ${plurale(n, "avviso", "avvisi")} e te ${n === 1 ? "lo" : "li"} legge al ritorno.`}
        </span>
      </div>
    );
  }
  if (!inCasella || !aspettano) return null;
  return (
    <div className="banda via senza">
      <div className="riga-banda">
        <Icona nome="info" />
        <span className="titolo t-sm medio">Sessioni non sa quando sei via</span>
      </div>
      <span className="dettaglio t-xs secondario">Con clotch gli avvisi aspettano il tuo ritorno. Intanto usa Non disturbare.</span>
    </div>
  );
}
