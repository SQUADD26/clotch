// figma: 101-25845 — «menu aggiungi» della casella: Allega file… (⌘U), Imposta obiettivo, Modalità piano (⇧⌘P), le skill dell'account.
// Obiettivo, piano e skill sono comandi con la barra: il menu li scrive all'inizio del messaggio, come li scriverebbe Roberto.
import { useEffect, useState } from "react";
import { BottoneIcona } from "../base/Bottone";
import { Menu, type VoceMenu } from "../base/Menu";
import { numero } from "../base/token";
import { casella } from "./percorsi";
import type { SkillNome } from "../../tipi";

const SKILL_VISTE = 2;

export function Aggiungi({ account, disabilitata, aperto, onApri, onChiudi, allega, comando }: {
  account: string; disabilitata: boolean; aperto: boolean; onApri(): void; onChiudi(): void; allega(): void; comando(testo: string): void;
}) {
  const [skill, setSkill] = useState<SkillNome[]>([]);
  const [tutte, setTutte] = useState(false);
  useEffect(() => {
    if (!aperto) return;
    let vivo = true;
    casella().skill(account).then((s) => vivo && setSkill(s), () => {});
    return () => { vivo = false; };
  }, [aperto, account]);
  const voci: VoceMenu[] = [
    { icona: "graffetta", etichetta: "Allega file…", scorciatoia: "⌘U", fai: allega },
    { icona: "obiettivo", etichetta: "Imposta obiettivo", fai: () => comando("/goal ") },
    { icona: "libro", etichetta: "Modalità piano", scorciatoia: "⇧⌘P", fai: () => comando("/plan ") },
    ...(skill.length ? [
      "separatore" as const, { gruppo: "Skill" },
      ...(tutte ? skill : skill.slice(0, SKILL_VISTE)).map((s): VoceMenu => ({ icona: "scintille", etichetta: s.nome, fai: () => comando(`/${s.nome} `) })),
      ...(!tutte && skill.length > SKILL_VISTE ? [{ icona: "altro" as const, etichetta: "Mostra tutte…", fai: () => { setTutte(true); onApri(); } }] : []),
    ] : []),
  ];
  return (
    <span className="aggiungi">
      <BottoneIcona icona="piu" etichetta="Aggiungi" disabled={disabilitata} aria-expanded={aperto} aria-haspopup="menu"
        onMouseDown={(e) => e.stopPropagation()} onClick={() => (aperto ? onChiudi() : onApri())} />
      {aperto && <Menu voci={voci} lato="sopra" scarto={numero("spazio-2")} classe="menu-aggiungi" onChiudi={onChiudi} />}
    </span>
  );
}
