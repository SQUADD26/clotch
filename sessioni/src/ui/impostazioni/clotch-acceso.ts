// «Clotch acceso?» si legge da un solo posto, pannello/clotch.ts (#350); nella prova vale lo stato del frame.
import { useEffect, useState } from "react";
import { clotchAcceso, suClotch } from "../pannello/clotch";
import { prova } from "./prova";

export function useClotchAcceso(): boolean {
  const [acceso, setAcceso] = useState(() => prova?.clotch ?? clotchAcceso());
  useEffect(() => (prova?.clotch === undefined ? suClotch(setAcceso) : undefined), []);
  return acceso;
}
