// La finestra dell'app e la prova di parità (`npm run parita -- <node-id>`): stessa pagina, stessa misura del frame Figma.
import { app, BrowserWindow, screen } from "electron";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { numero, valori } from "./ui/base/token";
import { iconaApp, NOME_APP } from "./branding";
import { proteggiLinkEsterni } from "./link-esterni";
import { provaSilenziosa } from "./modalita-prova";

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
export function apriFinestra(sessione?: string, opzioni: { show?: boolean } = {}): BrowserWindow | null {
  if (!fs.existsSync(pagina)) return null; // renderer non costruito: npm run build
  const grande = frame("101-8036").finestra, piccola = frame("101-8610").finestra;
  const silenziosa = provaSilenziosa(), anteprima = silenziosa && opzioni.show !== false;
  const area = anteprima ? (screen.getAllDisplays().find((d) => d.internal) ?? screen.getPrimaryDisplay()).workArea : null;
  const larghezza = area ? Math.min(grande.w, area.width) : grande.w;
  const altezza = area ? Math.min(grande.h, area.height) : grande.h;
  const w = new BrowserWindow({
    show: anteprima ? false : opzioni.show ?? true,
    title: NOME_APP, icon: iconaApp(),
    width: larghezza, height: altezza,
    minWidth: area ? Math.min(piccola.w, larghezza) : piccola.w,
    minHeight: area ? Math.min(piccola.h, altezza) : piccola.h,
    ...(area ? { x: area.x + Math.floor((area.width - larghezza) / 2), y: area.y + Math.floor((area.height - altezza) / 2) } : {}),
    backgroundColor: valori["colore-fondo-cornice"],
    titleBarStyle: "hiddenInset",
    // semaforo del Mac dove il disegno mette «semaforo»: padding della barra e centro verticale
    trafficLightPosition: { x: numero("spazio-5"), y: (numero("misura-barra-titolo") - numero("misura-semaforo")) / 2 },
    webPreferences: { preload, contextIsolation: true, webviewTag: false },
  });
  if (silenziosa) w.webContents.setAudioMuted(true);
  proteggiLinkEsterni(w);
  if (anteprima) w.once("ready-to-show", () => {
    w.showInactive();
    console.log(`PREVIEW_READY internal=${screen.getDisplayMatching(w.getBounds()).internal} visible=${w.isVisible()} focused=${w.isFocused()} audioMuted=${w.webContents.isAudioMuted()}`);
  });
  w.loadFile(pagina, sessione ? { query: { sessione } } : undefined);
  return w;
}

/** Disegna la pagina alla misura del frame, a scala 1, e salva design/app/<id>.png. `navigazione`: vista di partenza (scena.ts). */
export async function parita(id: string, navigazione?: Record<string, string | undefined>) {
  const { w: larga, h: alta } = frame(id);
  const w = new BrowserWindow({ width: larga, height: alta, show: false, focusable: false, frame: false, useContentSize: true, webPreferences: { preload, contextIsolation: true, webviewTag: false } });
  w.webContents.setAudioMuted(true);
  assert.equal(w.webContents.isAudioMuted(), true);
  let mostrate = 0, focalizzate = 0;
  w.on("show", () => mostrate++);
  w.on("focus", () => focalizzate++);
  assert.equal(w.isVisible(), false);
  assert.equal(w.isFocused(), false);
  proteggiLinkEsterni(w);
  await w.loadFile(pagina, { query: { ...Object.fromEntries(Object.entries(navigazione ?? {}).filter(([, v]) => v)) as Record<string, string>, parita: id } });
  // i dati arrivano dai canali IPC dopo il primo disegno: si aspetta che la rete dei canali si calmi, poi due fotogrammi
  await w.webContents.executeJavaScript(`document.fonts.ready.then(() => new Promise(r => setTimeout(r, ${ATTESA_DATI_MS}))).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
  const img = await w.webContents.capturePage();
  const out = path.join(radice, "design", "app", `${id}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  console.log(`parità: ${out} ${img.getSize().width}x${img.getSize().height}`);
  assert.equal(w.isVisible(), false);
  assert.equal(w.isFocused(), false);
  assert.equal(mostrate, 0);
  assert.equal(focalizzate, 0);
  assert.equal(w.webContents.isAudioMuted(), true);
  console.log("PARITA_HIDDEN_OK: visible=false focused=false show=0 focus=0 muted=true");
  app.quit();
}
