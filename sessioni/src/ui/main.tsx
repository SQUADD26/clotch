import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import * as barra from "./barra";
import * as chat from "./chat";
import * as clotchAi from "./clotch-ai";
import * as impostazioni from "./impostazioni";
import * as pannello from "./pannello";
import "./base/token.css";
import "./base/stile.css";
import { Cornice } from "./base/Cornice";
import { Pezzo } from "./base/Pezzo";

// ?parita=<node-id>: la pagina si disegna dentro il riquadro del frame Figma (npm run parita).
// Un frame che non è una finestra (foglio di stati di un pezzo) lo disegna il pezzo: export facoltativo
// `scene: Record<"<node-id>", () => JSX.Element>` nel suo index.tsx.
const parita = new URLSearchParams(location.search).get("parita");
if (parita) document.documentElement.classList.add("parita");
// ogni scena dentro il contenitore del suo pezzo, come nella cornice: il CSS del pezzo sta sotto `.pezzo-<nome>`
const pezzi = { barra, chat, "clotch-ai": clotchAi, impostazioni, pannello };
const scene = Object.fromEntries(Object.entries(pezzi).flatMap(([nome, m]) =>
  Object.entries((m as { scene?: Record<string, () => JSX.Element> }).scene ?? {}).map(([id, S]) => [id, () => <Pezzo nome={nome}><S /></Pezzo>]))) as Record<string, () => JSX.Element>;
const Scena = parita ? scene[parita] : undefined;
if (Scena) document.documentElement.classList.add("scena");
createRoot(document.getElementById("radice")!).render(Scena ? <Scena /> : <Cornice />);
