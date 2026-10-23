// figma: 101-35494 — «intestazione» delle viste Friday: icona e titolo, riga di stato (testi dai frame 101-35494, 35803,
// 36010, 36225, 37696, 38897, 39266, 40267, 40473, 41628, 41834, 42000, 42245).
import { BottoneIcona } from "../base/Bottone";
import { Icona, type NomeIcona } from "../base/Icona";
import { useNavigazione } from "../base/navigazione";
import { useAvvio, useRegistro } from "./dati";
import { orario } from "./formato";
import { casella, decisioniPerGiorno, statoFriday } from "./vista";

type Colore = "secondaria" | "accento" | "successo" | "errore";
interface Testa { icona: NomeIcona; accento?: boolean; titolo: string; segno?: [NomeIcona, Colore]; stato: string }

export const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`;

const SEGNO_FRIDAY: Record<string, [NomeIcona, Colore]> = { attiva: ["microfono", "successo"], spenta: ["avviso", "errore"], pausa: ["luna", "secondaria"] };

function testa(vista: string, s: ReturnType<typeof useRegistro>, avvio: "avvio" | "riavvio" | null): Testa {
  const r = s.dati;
  if (vista === "decisioni") {
    const g = r ? decisioniPerGiorno(r, Date.now()) : [];
    const n = g.filter((x) => x.titolo === "Oggi" || x.titolo === "Ieri").reduce((a, x) => a + x.voci.length, 0);
    return { icona: "libro", titolo: "Decisioni", stato: g.length ? `${n} decisioni tra oggi e ieri` : "Nessuna decisione" };
  }
  if (vista === "regole") {
    const n = r?.regole.length ?? 0;
    return { icona: "scudo", titolo: "Regole", stato: n ? plurale(n, "regola", "regole") : "Nessuna regola" };
  }
  if (vista === "casella") {
    if (s.stato === "carica") return { icona: "posta", titolo: "Casella", segno: ["spinner", "secondaria"], stato: "Leggo il registro…" };
    if (!r || s.stato === "errore" || r.errori.length) return { icona: "posta", titolo: "Casella", segno: ["avviso", "errore"], stato: "Registro non leggibile" };
    const c = casella(r, Date.now());
    if (!c.aspettano) return { icona: "posta", titolo: "Casella", segno: ["finita", "successo"], stato: "Niente in attesa" };
    return { icona: "posta", titolo: "Casella", segno: ["mano", "accento"], stato: `${c.aspettano === 1 ? "1 aspetta te" : `${c.aspettano} aspettano te`} · ${c.alLavoro} al lavoro` };
  }
  const st = r && statoFriday(r, Date.now());
  const segno: Testa["segno"] = avvio ? ["spinner", "secondaria"] : st ? SEGNO_FRIDAY[st.stato] : undefined;
  const stato = avvio === "avvio" ? "Avvio…" : avvio === "riavvio" ? "Riavvio…" : !st ? "" : st.stato === "spenta" ? "Spenta"
    : st.stato === "pausa" ? (st.da ? `In pausa fino alle ${orario(st.da)}` : "In pausa") : "Sempre attiva";
  return { icona: "scintille", accento: true, titolo: "Friday", segno, stato };
}

export function Intestazione() {
  const n = useNavigazione();
  const s = useRegistro();
  const avvio = useAvvio();
  const t = testa(n.vista, s, avvio);
  return (
    <div className="intestazione-friday">
      <div className="testi">
        <div className="riga-titolo">
          <Icona nome={t.icona} colore={t.accento ? "accento" : "secondaria"} />
          <span className="t-base medio">{t.titolo}</span>
        </div>
        <div className="stato">
          {t.segno && <Icona nome={t.segno[0]} colore={t.segno[1]} gira={t.segno[0] === "spinner"} />}
          <span className="t-xs secondario">{t.stato}</span>
        </div>
      </div>
      <div className="azioni-f">
        <BottoneIcona icona="pannello" etichetta="Pannello" onClick={n.alternaPannello} />
        {/* shortcut: il disegno non ha il menu «…» delle viste Friday; il bottone c'è per parità, senza menu finché Figma non lo disegna */}
        <BottoneIcona icona="altro" etichetta="Altro" />
      </div>
    </div>
  );
}
