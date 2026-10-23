import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import * as barra from "./barra";
import * as chat from "./chat";
import * as friday from "./friday";
import * as impostazioni from "./impostazioni";
import * as pannello from "./pannello";
import "./base/token.css";
import "./base/stile.css";
import { Cornice } from "./base/Cornice";

// ?parita=<node-id>: la pagina si disegna dentro il riquadro del frame Figma (npm run parita).
// Un frame che non è una finestra (foglio di stati di un pezzo) lo disegna il pezzo: export facoltativo
// `scene: Record<"<node-id>", () => JSX.Element>` nel suo index.tsx.
const parita = new URLSearchParams(location.search).get("parita");
if (parita) document.documentElement.classList.add("parita");
const scene = Object.assign({}, ...[barra, chat, friday, impostazioni, pannello]
  .map((m) => (m as { scene?: Record<string, () => JSX.Element> }).scene ?? {})) as Record<string, () => JSX.Element>;
const Scena = parita ? scene[parita] : undefined;
createRoot(document.getElementById("radice")!).render(Scena ? <Scena /> : <Cornice />);
