// figma: 101-12461 — icone dei componenti «Icona/*» del file Figma (generate in icone.ts), colore da un token «colore-icona-*».
import { icone, type NomeIcona } from "./icone";
import type { Token } from "./token";

export type { NomeIcona };
type ColoreIcona = Extract<Token, `colore-icona-${string}`> extends `colore-icona-${infer C}` ? C : never;

export function Icona({ nome, colore = "secondaria", gira = false }: { nome: NomeIcona; colore?: ColoreIcona; gira?: boolean }) {
  const f = icone[nome];
  return (
    <svg className={gira ? "icona gira" : "icona"} viewBox="0 0 16 16" aria-hidden style={{ color: `var(--colore-icona-${colore})` }}>
      <g transform={`translate(${f.x} ${f.y})`} fill="currentColor">
        {f.tracciati.map((t, i) => <path key={i} d={t.d} fillRule={t.pari ? "evenodd" : "nonzero"} />)}
      </g>
    </svg>
  );
}
