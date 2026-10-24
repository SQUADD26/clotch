// Il riflesso animato del titolo (#474) è solo CSS: nel DOM il titolo c'è una volta sola, anche per una sessione al lavoro.
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";
import * as ts from "typescript";

// I .tsx della UI sono ESM per Vite: qui li si carica in commonjs con transpileModule (i .css non servono).
const ext = require.extensions as Record<string, (m: any, f: string) => void>;
for (const e of [".ts", ".tsx"])
  if (!ext[e]) ext[e] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
ext[".css"] = () => {};
const SRC = path.join(__dirname, "..", "..", "src");
// useSyncExternalStore del renderer non ha lo snapshot per il server: le impostazioni si sostituiscono con un valore fisso.
const stato = path.join(SRC, "ui/impostazioni/stato.ts");
require.cache[stato] = { id: stato, filename: stato, loaded: true, exports: { useImpostazioni: () => ({ iconeSessioni: false }) } } as any;
const { RigaSessione } = require(path.join(SRC, "ui/barra/Righe.tsx"));
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const rendi = (stato: string) => renderToStaticMarkup(createElement(RigaSessione, {
  s: { id: "a", titolo: "Sessione b", stato }, pref: undefined, onApri() {}, onIcona() {}, onFissa() {}, onMenu() {}, onTroncato() {},
}));
/** textContent di `.testo`: dal suo tag fino al `.segno` che lo segue, senza i tag. */
const testo = (html: string) => html.match(/<span class="testo[^"]*">(.*?)<span class="segno"/s)![1].replace(/<[^>]*>/g, "");

test("riga sessione al lavoro: il testo di .testo è il titolo, una volta sola", () => {
  const html = rendi("lavora");
  assert.match(html, /class="testo lavoro"/);
  assert.equal(testo(html), "Sessione b");
});

test("riga sessione ferma: stesso testo", () => {
  assert.equal(testo(rendi("ferma")), "Sessione b");
});
