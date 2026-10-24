// Dati di una riga uno accanto all'altro, separati dalla distanza (spazio-2) e non da un segno: «Claude Code  accountmanager» (#1053).
import { Fragment, type ReactNode } from "react";

export const Pezzi = ({ parti }: { parti: ReactNode[] }) => <span className="pezzi">{parti.filter(Boolean).map((p, i) => <Fragment key={i}>{i > 0 && " "}<span>{p}</span></Fragment>)}</span>;
