// Impostazioni «Aspetto» (frame 101-31738; tendine 119-55904, 119-56054, 119-56211, 119-56375): un solo punto che le porta sulla radice
// come data-tema/-colore/-carattere/-dimensione/-densita; le regole che ridefiniscono i token stanno in aspetto.css.
import { useEffect } from "react";
import { caricaImpostazioni, useImpostazioni } from "../impostazioni/stato";

export function useAspetto() {
  const { tema, colore, carattere, dimensione, densita } = useImpostazioni();
  useEffect(caricaImpostazioni, []);
  useEffect(() => {
    const d = document.documentElement.dataset;
    d.tema = tema.toLowerCase(); d.colore = colore.toLowerCase(); d.carattere = carattere.toLowerCase(); d.dimensione = dimensione.toLowerCase(); d.densita = densita.toLowerCase();
  }, [tema, colore, carattere, dimensione, densita]);
}
