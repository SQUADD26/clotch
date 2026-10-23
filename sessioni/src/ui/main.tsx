import { createRoot } from "react-dom/client";
import "./base/token.css";
import "./base/stile.css";
import { Cornice } from "./base/Cornice";

// ?parita=<node-id>: la pagina si disegna dentro il riquadro del frame Figma (npm run parita)
if (new URLSearchParams(location.search).has("parita")) document.documentElement.classList.add("parita");
createRoot(document.getElementById("radice")!).render(<Cornice />);
