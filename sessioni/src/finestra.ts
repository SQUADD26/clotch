// La finestra dell'app e la prova di parità (`npm run parita -- <node-id>`): stessa pagina, stessa misura del frame Figma.
import { app, BrowserWindow } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { numero, valori } from "./ui/base/token";
import { iconaApp, NOME_APP } from "./branding";
import { proteggiLinkEsterni } from "./link-esterni";

const radice = path.join(__dirname, "..", "..");
const pagina = path.join(radice, "renderer", "index.html");
const preload = path.join(__dirname, "preload.js");
const ATTESA_DATI_MS = 500; // scene di prova: le risposte IPC arrivano in pochi ms, 500 lascia margine agli effetti che ne seguono

/** Misura di un frame esportato in design/figma/<id>.json; la finestra di 101:8036 è la misura di partenza. */
function frame(id: string) {
  const f = JSON.parse(fs.readFileSync(path.join(radice, "design", "figma", `${id}.json`), "utf8"));
  const finestra = f.nodi.find((n: { nome: string }) => n.nome === "finestra")?.box;
  return { w: f.frame.w as number, h: f.frame.h as number, finestra: finestra as { w: number; h: number } };
}

/** `sessione`: la finestra si apre già su quella sessione («Apri in una nuova finestra»). */
export function apriFinestra(sessione?: string): BrowserWindow | null {
  if (!fs.existsSync(pagina)) return null; // renderer non costruito: npm run build
  const grande = frame("101-8036").finestra, piccola = frame("101-8610").finestra;
  const w = new BrowserWindow({
    title: NOME_APP, icon: iconaApp(),
    width: grande.w, height: grande.h, minWidth: piccola.w, minHeight: piccola.h,
    backgroundColor: valori["colore-fondo-cornice"],
    titleBarStyle: "hiddenInset",
    // semaforo del Mac dove il disegno mette «semaforo»: padding della barra e centro verticale
    trafficLightPosition: { x: numero("spazio-5"), y: (numero("misura-barra-titolo") - numero("misura-semaforo")) / 2 },
    webPreferences: { preload, contextIsolation: true, webviewTag: false },
  });
  proteggiLinkEsterni(w);
  w.loadFile(pagina, sessione ? { query: { sessione } } : undefined);
  return w;
}

/** Disegna la pagina alla misura del frame, a scala 1, e salva design/app/<id>.png. `navigazione`: vista di partenza (scena.ts). */
export async function parita(id: string, navigazione?: Record<string, string | undefined>) {
  const { w: larga, h: alta } = frame(id);
  const w = new BrowserWindow({ width: larga, height: alta, show: false, frame: false, useContentSize: true, webPreferences: { preload, contextIsolation: true, webviewTag: false } });
  proteggiLinkEsterni(w);
  await w.loadFile(pagina, { query: { ...Object.fromEntries(Object.entries(navigazione ?? {}).filter(([, v]) => v)) as Record<string, string>, parita: id } });
  // i dati arrivano dai canali IPC dopo il primo disegno: si aspetta che la rete dei canali si calmi, poi due fotogrammi
  await w.webContents.executeJavaScript(`document.fonts.ready.then(() => new Promise(r => setTimeout(r, ${ATTESA_DATI_MS}))).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
  const img = await w.webContents.capturePage();
  const out = path.join(radice, "design", "app", `${id}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  console.log(`parità: ${out} ${img.getSize().width}x${img.getSize().height}`);
  app.quit();
}
