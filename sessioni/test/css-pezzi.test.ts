// Il CSS di un pezzo (src/ui/<pezzo>/*.css) sta tutto sotto `.pezzo-<pezzo>`: Vite fa un solo foglio e una regola
// senza prefisso cambia gli altri pezzi (#403). La base (src/ui/base) è di tutti e resta senza prefisso.
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

const UI = path.join(process.cwd(), "src/ui");

test("css dei pezzi: ogni regola sotto .pezzo-<pezzo>", () => {
  const fuori: string[] = [];
  for (const pezzo of fs.readdirSync(UI).filter((d) => d !== "base" && fs.statSync(path.join(UI, d)).isDirectory()))
    for (const f of fs.readdirSync(path.join(UI, pezzo)).filter((f) => f.endsWith(".css"))) {
      const css = fs.readFileSync(path.join(UI, pezzo, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");
      for (const m of css.matchAll(/(?:^|})\s*([^{}@]+)\{/g))
        for (const s of m[1].split(",").map((x) => x.trim()))
          if (!s.startsWith(`.pezzo-${pezzo} `)) fuori.push(`${pezzo}/${f}: ${s}`);
    }
  assert.deepEqual(fuori, []);
});
