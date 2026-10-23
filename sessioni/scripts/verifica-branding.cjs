// Eseguire dopo npm run build: electron scripts/verifica-branding.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { app, BrowserWindow, Menu } = require("electron");
const { impostaNome, impostaIdentita, iconaApp, NOME_APP } = require("../dist/src/branding");

process.env.CLOTCH_TEST_SILENT = "1";
app.commandLine.appendSwitch("mute-audio");
if (process.platform === "darwin") app.setActivationPolicy("prohibited");
let mostrate = 0, focalizzate = 0;
app.on("browser-window-created", (_evento, finestra) => {
  finestra.on("show", () => mostrate++);
  finestra.on("focus", () => focalizzate++);
});

function vecchiNomi(testo, nome) {
  const sorgente = ts.createSourceFile(nome, testo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const vecchi = [];
  function visita(nodo) {
    if (ts.isStringLiteralLike(nodo) || ts.isJsxText(nodo) || ts.isTemplateHead(nodo) || ts.isTemplateMiddle(nodo) || ts.isTemplateTail(nodo)) {
      const testo = nodo.text;
      if (!testo.startsWith(".") && (/\bFriday\b|\bClotch\b/.test(testo) || /(?:di|da|su|in) Sessioni\b|Sessioni (?:parte|scrive|fa|le rilegge)/.test(testo))) vecchi.push(testo);
    }
    ts.forEachChild(nodo, visita);
  }
  visita(sorgente);
  return vecchi;
}

async function verifica() {
  assert.equal(vecchiNomi('const nome = "Friday"; <span>Clotch</span>', "controllo.tsx").length, 2);
  for (const nome of fs.readdirSync(path.join(__dirname, "../src/ui"), { recursive: true })) {
    if (!/\.(tsx?|html)$/.test(nome) || /(?:^|\/)(?:prova|scene)\./.test(nome)) continue;
    const testo = fs.readFileSync(path.join(__dirname, "../src/ui", nome), "utf8");
    if (!nome.endsWith(".html")) assert.deepEqual(vecchiNomi(testo, nome), [], nome);
  }
  impostaNome();
  assert.equal(app.getName(), "clotch");
  const dati = app.getPath("userData");
  assert.notEqual(dati, path.join(app.getPath("appData"), "clotch-sessioni"));
  assert.equal(path.basename(dati), "userData");
  assert.match(path.basename(path.dirname(dati)), /^clotch-prova-/);
  assert.equal(app.getPath("sessionData"), path.join(path.dirname(dati), "sessionData"));
  await app.whenReady();
  impostaIdentita();
  const icona = iconaApp();
  assert.equal(icona.isEmpty(), false);
  assert.ok(icona.getSize().width > 0);
  if (process.platform === "darwin") assert.equal(Menu.getApplicationMenu().items[0].label, "clotch");
  const finestra = new BrowserWindow({ show: false, focusable: false, title: NOME_APP, icon: icona, webPreferences: { javascript: false } });
  finestra.webContents.setAudioMuted(true);
  assert.equal(finestra.webContents.isAudioMuted(), true);
  assert.equal(finestra.isVisible(), false);
  assert.equal(finestra.isFocused(), false);
  await finestra.loadFile(path.join(__dirname, "../renderer/index.html"));
  assert.equal(finestra.getTitle(), "clotch");
  console.log(`branding OK: app=${app.getName()}, titolo=${finestra.getTitle()}, icona=${icona.getSize().width}x${icona.getSize().height}, dati conservati`);
  console.log("nomi UI OK: nessun Friday, Clotch o nome app Sessioni; controllo positivo verificato");
  assert.equal(finestra.isVisible(), false);
  assert.equal(finestra.isFocused(), false);
  assert.equal(mostrate, 0);
  assert.equal(focalizzate, 0);
  assert.equal(finestra.webContents.isAudioMuted(), true);
  console.log("BRANDING_HIDDEN_OK: visible=false focused=false show=0 focus=0 muted=true");
  finestra.destroy();
}

verifica().then(() => app.exit(0), (errore) => { console.error(errore); app.exit(1); });
