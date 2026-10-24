// figma: 101-35494 — «intestazione» delle viste clotch AI: icona e titolo, riga di stato (testi dai frame 101-35494, 35803,
// 36010, 36225, 37696, 38897, 39266, 40267, 40473, 41628, 41834, 42000, 42245).
import { Icona, type NomeIcona } from "../base/Icona";
import { plurale } from "../base/formato";
import { useNavigazione } from "../base/navigazione";
import { useAvvio, useRegistro } from "./dati";
import { useVoce as useStatoVoce } from "./Voce";
import type { StatoVoce } from "./statoVoce";
import { orario } from "./formato";
import { casella, decisioniPerGiorno, statoClotchAi } from "./vista";
import { useVoce } from "./dettatura";
import { inAttesa } from "./StatoRegistro";

type Colore = "secondaria" | "accento" | "successo" | "errore";
interface Testa { icona: NomeIcona; accento?: boolean; titolo: string; segno?: [NomeIcona, Colore]; stato: string }


const VISTE_REGISTRO: Record<string, [NomeIcona, string]> = { casella: ["posta", "Casella"], decisioni: ["libro", "Decisioni"], regole: ["scudo", "Regole"] };

const SEGNO_CLOTCH_AI: Record<string, [NomeIcona, Colore]> = { attiva: ["microfono", "successo"], spenta: ["avviso", "errore"], pausa: ["luna", "secondaria"] };

// riga di stato mentre la voce fa qualcosa (101-36832, 37055, 37278): al posto di «Sempre attiva»
const STATO_VOCE: Record<StatoVoce, [NomeIcona, Colore, string]> = {
  ascolta: ["microfono", "accento", "Ti ascolta"], parla: ["scintille", "secondaria", "Sta parlando"], "mic-no": ["avviso", "errore", "Microfono non disponibile"],
};

function testa(vista: string, s: ReturnType<typeof useRegistro>, avvio: "avvio" | "riavvio" | null, voce: StatoVoce | null): Testa {
  const r = s.dati;
  const lista = VISTE_REGISTRO[vista];
  if (lista) {
    const [icona, titolo] = lista, attesa = inAttesa(s);
    // finché il registro non si legge non si sa se è vuoto (#1044)
    if (attesa) return { icona, titolo, segno: attesa === "carica" ? ["spinner", "secondaria"] : ["avviso", "errore"], stato: attesa === "carica" ? "Leggendo il registro…" : "Registro non leggibile" };
  }
  if (vista === "decisioni") {
    const g = decisioniPerGiorno(r!, Date.now());
    const tot = g.reduce((a, x) => a + x.voci.length, 0);
    const n = g.filter((x) => x.titolo === "Oggi" || x.titolo === "Ieri").reduce((a, x) => a + x.voci.length, 0);
    return { icona: "libro", titolo: "Decisioni", stato: !tot ? "Nessuna decisione" : n === tot ? `${plurale(n, "decisione", "decisioni")} tra oggi e ieri` : plurale(tot, "decisione", "decisioni") };
  }
  if (vista === "regole") {
    const n = r!.regole.length;
    return { icona: "scudo", titolo: "Regole", stato: n ? plurale(n, "regola", "regole") : "Nessuna regola" };
  }
  if (vista === "casella") {
    const c = casella(r!, Date.now());
    if (!c.aspettano) return { icona: "posta", titolo: "Casella", segno: ["finita", "successo"], stato: "Niente in attesa" };
    return { icona: "posta", titolo: "Casella", segno: ["mano", "accento"], stato: `${c.aspettano === 1 ? "1 aspetta te" : `${c.aspettano} aspettano te`} ${c.alLavoro} al lavoro` };
  }
  const st = r && statoClotchAi(r, Date.now());
  const segno: Testa["segno"] = avvio ? ["spinner", "secondaria"] : st ? SEGNO_CLOTCH_AI[st.stato] : undefined;
  if (voce && !avvio && st?.stato === "attiva") {
    const [icona, colore, testo] = STATO_VOCE[voce];
    return { icona: "scintille", accento: true, titolo: "clotch AI", segno: [icona, colore], stato: testo };
  }
  const stato = avvio === "avvio" ? "Avviando…" : avvio === "riavvio" ? "Riavviando…" : !st ? "" : st.stato === "spenta" ? "Spenta"
    : st.stato === "pausa" ? (st.da ? `In pausa fino alle ${orario(st.da)}` : "In pausa") : "Sempre attiva";
  return { icona: "scintille", accento: true, titolo: "clotch AI", segno, stato };
}

export function Intestazione() {
  const n = useNavigazione();
  const s = useRegistro();
  const avvio = useAvvio();
  // Clotch, l'app o il microfono del Mac (dettatura): chi parla o ascolta; il resto (microfono assente) lo dice il registro
  const voce = useVoce(), registro = useStatoVoce().stato;
  const t = testa(n.vista, s, avvio, voce ? (voce.cosa === "parla" ? "parla" : "ascolta") : registro);
  return (
    <div className="intestazione-clotch-ai">
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
    </div>
  );
}
