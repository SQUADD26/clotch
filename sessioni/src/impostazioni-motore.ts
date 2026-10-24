// Le due impostazioni di Impostazioni › clotch che il notch legge dai file della voce (~/.config/voce): chi legge è già nel notch Swift
// (`VoiceFiles.offURL`: il file «spento» zittisce la voce; `VoiceInput.Config`: `ingresso_acceso` in config.json). Qui si scrivono dove entra il valore (#534).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function applicaMotore(parte: Record<string, unknown>, casa = os.homedir()) {
  const voce = path.join(casa, ".config", "voce");
  if (typeof parte.clotchVoce === "boolean") {
    const spento = path.join(voce, "spento");
    if (parte.clotchVoce) fs.rmSync(spento, { force: true });
    else { fs.mkdirSync(voce, { recursive: true }); fs.writeFileSync(spento, ""); }
  }
  if (typeof parte.clotchDettatura === "boolean") {
    const config = path.join(voce, "config.json");
    let c: unknown = {};
    try { c = JSON.parse(fs.readFileSync(config, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") return; } // illeggibile: non si sovrascrive, come il notch
    if (!c || typeof c !== "object" || Array.isArray(c)) return;
    fs.mkdirSync(voce, { recursive: true });
    fs.writeFileSync(`${config}.tmp`, JSON.stringify({ ...c, ingresso_acceso: parte.clotchDettatura }, null, 2) + "\n");
    fs.renameSync(`${config}.tmp`, config);
  }
}
