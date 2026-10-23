// «Clotch acceso?» si legge da un solo posto, pannello/clotch.ts (#350); nella prova lo dà il registro della scena.
import { useEffect, useState } from "react";
import { clotchAcceso, suClotch } from "../pannello/clotch";

export function useClotchAcceso(): boolean {
  const [acceso, setAcceso] = useState(clotchAcceso);
  useEffect(() => suClotch(setAcceso), []);
  return acceso;
}
