// figma: 101-8036 — contenitore senza misura (display: contents) intorno a ciò che un pezzo monta nella cornice:
// il CSS del pezzo sta tutto sotto `.pezzo-<nome>` e non tocca gli altri pezzi (#403).
import type { ReactNode } from "react";

export function Pezzo({ nome, children }: { nome: string; children: ReactNode }) {
  return <div className={`pezzo pezzo-${nome}`}>{children}</div>;
}
