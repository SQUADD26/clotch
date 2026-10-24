// figma: 101-8036 — contenitore senza misura (display: contents) intorno a ciò che un pezzo monta nella cornice:
// il CSS del pezzo sta tutto sotto `.pezzo-<nome>` e non tocca gli altri pezzi (#403).
import { Component, type ReactNode } from "react";
import { StatoErrore } from "./Stati";

// Un errore di render in un pezzo spegne solo quel pezzo: barra, chat e impostazioni vicine restano.
// Un pezzo grande (`centro`) rotto mostra «Questa parte non si apre» con «Riprova» come «Cartella non leggibile» (101-9090); i piccoli (testate, comandi, dialoghi) restano vuoti.
class Argine extends Component<{ nome: string; centro: boolean; children: ReactNode }, { rotto: boolean }> {
  state = { rotto: false };
  static getDerivedStateFromError() { return { rotto: true }; }
  componentDidCatch(e: unknown) { console.error(`Pezzo «${this.props.nome}» non disponibile:`, e); }
  render() {
    if (!this.state.rotto) return this.props.children;
    return this.props.centro ? <StatoErrore titolo="Questa parte non si apre" corpo="Qualcosa non ha funzionato. Riprova: se succede ancora, riapri clotch." riprova={() => this.setState({ rotto: false })} /> : null;
  }
}

export function Pezzo({ nome, centro = false, children }: { nome: string; centro?: boolean; children: ReactNode }) {
  return <div className={`pezzo pezzo-${nome}`}><Argine nome={nome} centro={centro}>{children}</Argine></div>;
}
