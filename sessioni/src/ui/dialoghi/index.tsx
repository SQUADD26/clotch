// figma: 101-22137 — monta i dialoghi dell'app (aggiornamento, scorciatoie) e i tasti che non stanno in «Impostazioni · Scorciatoie»:
// ⌘/ apre le scorciatoie, ⌃↑ e ⌃↓ passano alla sessione prima e dopo. Nelle scene di prova `sezione` = «dialogo-aggiornamento» o «dialogo-scorciatoie».
import { useEffect } from "react";
import { useApriSessione } from "../barra/apri";
import { alternaDialogo, apriDialogo, useDialogo, type NomeDialogo } from "../base/dialoghi";
import { useElenco } from "../base/dati";
import { useNavigazione } from "../base/navigazione";
import { provaDi } from "../chat/testi";
import { DialogoAggiornamento } from "./Aggiornamento";
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
    for (const nome of ["aggiornamento", "scorciatoie"] as NomeDialogo[]) if (provaDi(n.sezione, `dialogo-${nome}`) !== null) apriDialogo(nome);
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
  return aperto === "aggiornamento" ? <DialogoAggiornamento /> : aperto === "scorciatoie" ? <DialogoScorciatoie /> : null;
}
