// figma: 101-22137 — monta i dialoghi dell'app (aggiornamento, scorciatoie, rinomina, novità) e i tasti che non stanno in «Impostazioni · Scorciatoie»:
// ⌘/ apre le scorciatoie, ⌃↑ e ⌃↓ passano alla sessione prima e dopo. Nelle scene di prova `sezione` = «dialogo-aggiornamento», «dialogo-scorciatoie» o «dialogo-rinomina:<nome>».
import { useEffect } from "react";
import { useApriSessione } from "../barra/apri";
import { alternaDialogo, apriDialogo, useDialogo, type DatiDialoghi } from "../base/dialoghi";
import { useElenco } from "../base/dati";
import { useNavigazione } from "../base/navigazione";
import { provaDi } from "../chat/testi";
import { DialogoAggiornamento } from "./Aggiornamento";
import { DialogoNovita } from "./Novita";
import { DialogoRinomina } from "./Rinomina";
import { DialogoScorciatoie } from "./Scorciatoie";
import { vicina } from "./vicina";
import "./dialoghi.css";

const inCampo = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function Dialoghi() {
  const n = useNavigazione();
  const aperto = useDialogo();
  const apriSessione = useApriSessione();
  const sessioni = useElenco().dati?.sessioni;
  useEffect(() => {
    for (const nome of ["aggiornamento", "scorciatoie"] as const) if (provaDi(n.sezione, `dialogo-${nome}`) !== null) apriDialogo(nome);
    const rinomina = provaDi(n.sezione, "dialogo-rinomina"); // 101-22044: il nome già scritto nel campo
    if (rinomina !== null) apriDialogo("rinomina", { titolo: "Rinomina sessione", valore: rinomina, nota: "Il nome cambia solo in clotch.", salva() {} });
  }, [n.sezione]);
  useEffect(() => {
    const premi = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey && e.key === "/") { e.preventDefault(); alternaDialogo("scorciatoie"); return; }
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || inCampo(e.target) || n.vista !== "sessione") return;
      const passo = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      const id = passo ? vicina(sessioni ?? [], n.sessione, passo) : null;
      if (id) { e.preventDefault(); apriSessione(id); }
    };
    addEventListener("keydown", premi);
    return () => removeEventListener("keydown", premi);
  }, [n.vista, n.sessione, sessioni, apriSessione]);
  const dialogo = (() => {
    switch (aperto?.nome) {
      case "aggiornamento": return <DialogoAggiornamento />;
      case "scorciatoie": return <DialogoScorciatoie />;
      case "rinomina": return <DialogoRinomina {...(aperto.dati as DatiDialoghi["rinomina"])} />;
      case "novita": return <DialogoNovita {...(aperto.dati as DatiDialoghi["novita"])} />;
      default: return null;
    }
  })();
  // nelle impostazioni i dialoghi stanno al centro della finestra (101-22095, 119-57552); altrove spazio-10 più in alto (101-37696)
  return dialogo && <div className={n.vista === "impostazioni" ? "dialoghi-vista centrato" : "dialoghi-vista"}>{dialogo}</div>;
}
