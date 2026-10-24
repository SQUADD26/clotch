// figma: 101-8036 — contenitore senza misura (display: contents) intorno a ciò che un pezzo monta nella cornice:
// il CSS del pezzo sta tutto sotto `.pezzo-<nome>` e non tocca gli altri pezzi (#403).
import { Component, type ReactNode } from "react";

// Un errore di render in un pezzo spegne solo quel pezzo: barra, chat e impostazioni vicine restano.
// shortcut: il pezzo rotto resta vuoto, senza testo, fino al riavvio (manca il disegno Figma di «pezzo non disponibile» con «Riprova»).
class Argine extends Component<{ nome: string; children: ReactNode }, { rotto: boolean }> {
  state = { rotto: false };
  static getDerivedStateFromError() { return { rotto: true }; }
  componentDidCatch(e: unknown) { console.error(`Pezzo «${this.props.nome}» non disponibile:`, e); }
  render() { return this.state.rotto ? null : this.props.children; }
}

export function Pezzo({ nome, children }: { nome: string; children: ReactNode }) {
  return <div className={`pezzo pezzo-${nome}`}><Argine nome={nome}>{children}</Argine></div>;
}
