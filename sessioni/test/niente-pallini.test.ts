// Il punto mediano «·» come separatore non esiste nell'app (#1053): nel testo visibile di src/ui e dei testi composti del main.
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

const tutti = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tutti(path.join(d, e.name)) : [path.join(d, e.name)]));

test("niente «·» nel testo visibile (commenti esclusi)", () => {
  const trovati: string[] = [];
  for (const f of [...tutti(path.join(process.cwd(), "src/ui")), ...["impostazioni.ts", "uso-testi.ts"].map((x) => path.join(process.cwd(), "src", x))].filter((f) => /\.(tsx?|css)$/.test(f)))
    fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").forEach((r, i) => {
      if (/^\s*\/\//.test(r) ? false : r.replace(/\s\/\/ .*$/, "").includes("·")) trovati.push(`${path.relative(process.cwd(), f)}:${i + 1}`);
    });
  assert.deepEqual(trovati, []);
});
