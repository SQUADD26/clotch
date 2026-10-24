// #534: Voce e Dettatura dal notch scrivono i file che il notch legge; prove su una casa finta.
import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import assert from "node:assert/strict";
import { applicaMotore } from "../src/impostazioni-motore";

const casa = () => fs.mkdtempSync(path.join(os.tmpdir(), "motore-"));

test("Voce dal notch: spenta crea «spento», accesa lo toglie", () => {
  const h = casa(), spento = path.join(h, ".config/voce/spento");
  applicaMotore({ clotchVoce: false }, h); assert.ok(fs.existsSync(spento));
  applicaMotore({ clotchVoce: true }, h); assert.ok(!fs.existsSync(spento));
});

test("Dettatura dal notch: scrive ingresso_acceso e lascia le altre chiavi", () => {
  const h = casa(), cfg = path.join(h, ".config/voce/config.json");
  fs.mkdirSync(path.dirname(cfg), { recursive: true }); fs.writeFileSync(cfg, JSON.stringify({ ingresso_lingua: "it" }));
  applicaMotore({ clotchDettatura: false }, h);
  assert.deepEqual(JSON.parse(fs.readFileSync(cfg, "utf8")), { ingresso_lingua: "it", ingresso_acceso: false });
  applicaMotore({ clotchDettatura: true }, h);
  assert.equal(JSON.parse(fs.readFileSync(cfg, "utf8")).ingresso_acceso, true);
});

test("Dettatura: config illeggibile non si sovrascrive; senza file lo crea; altre chiavi non toccano niente", () => {
  const h = casa(), cfg = path.join(h, ".config/voce/config.json");
  applicaMotore({ apriAllAvvio: false }, h); assert.ok(!fs.existsSync(path.join(h, ".config")));
  applicaMotore({ clotchDettatura: false }, h); assert.equal(JSON.parse(fs.readFileSync(cfg, "utf8")).ingresso_acceso, false);
  fs.writeFileSync(cfg, "{rotto"); applicaMotore({ clotchDettatura: true }, h); assert.equal(fs.readFileSync(cfg, "utf8"), "{rotto");
});
