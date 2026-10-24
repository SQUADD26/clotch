// Testi visibili (#623): un solo apostrofo, quello tipografico (’); mai quello dritto dentro una stringa.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const files = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []);

test("apostrofo dritto nei testi visibili (#623)", () => {
  const trovati: string[] = [];
  for (const f of files(path.resolve("src"))) {
    if (/\/(prova|scena)[^/]*\.tsx?$/.test(f) || f.endsWith("prove-collegamento.ts") || f.endsWith("chat/modello.ts")) continue;
    fs.readFileSync(f, "utf8").split("\n").forEach((riga, i) => {
      const codice = riga.replace(/\/\*.*?\*\//g, "").replace(/^\s*(\*|\/\/).*$/, "").replace(/\/\*\*.*$/, "").replace(/\s\/\/.*$/, "");
      if (/[a-zà-ú]'[a-zà-ú]/i.test(codice)) trovati.push(`${path.relative(".", f)}:${i + 1}`);
    });
  }
  assert.deepEqual(trovati, []);
});
