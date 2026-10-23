// Moduli main/branding/logger reali in VM: nessun Electron o dato utente reale.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";

function ambiente(args: string[] = [], silenziosa = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "clotch-profile-fixture-"));
  const reale = path.join(root, "reale");
  fs.mkdirSync(path.join(reale, "clotch-sessioni"), { recursive: true });
  const sentinella = path.join(reale, "clotch-sessioni", "preferenze.json");
  fs.writeFileSync(sentinella, JSON.stringify({ app: { cartellaRegistro: path.join(reale, "logs") } }));
  const paths: Record<string, string> = { appData: reale, userData: path.dirname(sentinella), sessionData: reale };
  const eventi: string[] = [], temporanei: string[] = [], accessi: string[] = [];
  const processo = Object.assign(new EventEmitter(), {
    platform: "darwin", argv: ["electron", ".", ...args], env: silenziosa ? { CLOTCH_TEST_SILENT: "1" } : {} as Record<string, string>,
  });
  const app = Object.assign(new EventEmitter(), {
    commandLine: { appendSwitch: (n: string) => eventi.push(`switch:${n}`) },
    setActivationPolicy: (n: string) => eventi.push(`policy:${n}`),
    setName: (_n: string) => {},
    getPath: (n: string) => { eventi.push(`get:${n}`); return paths[n]; },
    setPath: (n: string, p: string) => { paths[n] = p; eventi.push(`set:${n}`); },
    whenReady: () => { eventi.push("ready"); return Promise.resolve(); },
    exit: (n: number) => eventi.push(`exit:${n}`),
  });
  const protetto = (p: unknown) => {
    if (typeof p !== "string") return;
    accessi.push(p);
    assert.ok(p !== reale && !p.startsWith(`${reale}${path.sep}`), `accesso al profilo reale: ${p}`);
  };
  const disco = new Proxy(fs, { get(target, key: keyof typeof fs) {
    if (key === "mkdtempSync") return (prefix: string) => {
      const p = fs.mkdtempSync(path.join(root, path.basename(prefix)));
      temporanei.push(p); return p;
    };
    if (["readFileSync", "writeFileSync", "appendFileSync", "mkdirSync", "rmSync"].includes(String(key)))
      return (p: string, ...rest: unknown[]) => { protetto(p); return (target[key] as (...a: unknown[]) => unknown)(p, ...rest); };
    return target[key];
  } });
  const carica = (nome: string, modules: Record<string, unknown>) => {
    const output: Record<string, (...a: any[]) => any> = {};
    runInNewContext(fs.readFileSync(path.join(__dirname, "../src", `${nome}.js`), "utf8"), {
      exports: output, __dirname: "/fixture/dist/src", process: processo,
      console: { error() {} }, require: (id: string) => {
        assert.ok(Object.hasOwn(modules, id), `import inatteso ${nome}: ${id}`);
        return modules[id];
      },
    });
    return output;
  };
  const modo = { provaSilenziosa: () => processo.env.CLOTCH_TEST_SILENT === "1" };
  const branding = carica("branding", { electron: { app }, "node:path": path, "node:os": os, "node:fs": disco, "./modalita-prova": modo });
  const registro = carica("registro", { "node:fs": disco, "node:os": os, "node:path": path });
  const preferenze = carica("preferenze", { "node:fs": disco, "node:path": path });
  const cleanup = () => { for (const p of temporanei) fs.rmSync(p, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); };
  return { root, reale, paths, sentinella, eventi, temporanei, accessi, processo, app, carica, modo, branding, registro, preferenze, cleanup };
}

test("profilo di prova: istanze distinte, idempotenza e cleanup; app normale preservata", () => {
  const a = ambiente([], true), b = ambiente([], true), normale = ambiente();
  try {
    for (const f of [a, b]) {
      f.branding.impostaNome();
      assert.equal(f.temporanei.length, 1);
      for (const nome of ["userData", "sessionData", "logs", "crashDumps"])
        assert.ok(f.paths[nome].startsWith(f.temporanei[0] + path.sep), nome);
      assert.ok(!f.eventi.includes("get:appData"));
      const prima = f.paths.userData;
      f.branding.impostaNome();
      assert.equal(f.paths.userData, prima); assert.equal(f.temporanei.length, 1);
    }
    assert.notEqual(a.paths.userData, b.paths.userData);
    a.app.emit("quit"); b.processo.emit("exit", 0);
    assert.ok(!fs.existsSync(a.temporanei[0])); assert.ok(!fs.existsSync(b.temporanei[0]));
    a.processo.emit("exit", 0); // cleanup ripetuto non ricrea nulla
    normale.branding.impostaNome();
    assert.equal(normale.paths.userData, path.join(normale.reale, "clotch-sessioni"));
    assert.equal(normale.temporanei.length, 0);
    console.log("PROFILE_PROCESS_UNIQUE_CLEANUP_AND_NORMAL_OK");
  } finally { a.cleanup(); b.cleanup(); normale.cleanup(); }
});

test("parità: profilo prima import/ready; errori IPC/processo non leggono o scrivono il profilo reale", async () => {
  for (const scena of [{ navigazione: {} }, null, new SyntaxError("scena fixture rotta")]) {
    const f = ambiente(["--parita", "101-8036"]);
    const handlers = new Map<string, (...a: any[]) => any>();
    const eventoIpc = { fixture: "chiamante autorizzato" };
    let letturePreferenze = 0;
    try {
      const modules: Record<string, unknown> = {
        electron: { app: f.app, ipcMain: { handle: (id: string, fn: (...a: any[]) => any) => handlers.set(id, fn) }, BrowserWindow: {} },
        "node:os": os, "node:path": path,
        "./branding": { ...f.branding, impostaIdentita() {} }, "./modalita-prova": f.modo,
        "./ipc-fiducia": { verificaChiamante: (evento: unknown) => assert.equal(evento, eventoIpc) },
        "./api": { Sessioni: class {} }, "./avvisi-mac": {}, "./barra-menu": {}, "./finestra": { parita() {} },
        "./friday-ipc": {}, "./impostazioni": {}, "./indice-ipc": {}, "./info-sessione": { infoSessione() {} }, "./preferenze-ipc": {},
        "./preferenze": { leggiImpostazioni: (...a: string[]) => { letturePreferenze++; return f.preferenze.leggiImpostazioni(...a); } },
        "./registro": f.registro,
        "./scena": { fileScena: () => "/fixture/scene.json", leggiScena: () => { if (scena instanceof Error) throw scena; return scena; },
          collegaScena: (ipc: { handle: (id: string, fn: () => never) => void }) => ipc.handle("fixture:errore", () => { throw new Error("errore IPC fixture"); }) },
      };
      const guarded = new Proxy(modules, { get(target, id: string) {
        if (["./api", "./preferenze", "./registro"].includes(id)) {
          assert.ok(f.paths.userData !== path.join(f.reale, "clotch-sessioni"), `profilo prima import ${id}`);
          f.eventi.push(`import:${id}`);
        }
        return target[id];
      } });
      f.carica("main", guarded);
      await new Promise(setImmediate);
      const userSet = f.eventi.indexOf("set:userData");
      assert.ok(userSet >= 0 && userSet < f.eventi.indexOf("ready"));
      for (const id of ["./api", "./preferenze", "./registro"]) assert.ok(userSet < f.eventi.indexOf(`import:${id}`));
      assert.ok(f.eventi.indexOf("policy:prohibited") < f.eventi.indexOf("ready"));
      // Anche una preferenza temp ostile non può deviare il logger sul profilo reale.
      fs.writeFileSync(path.join(f.paths.userData, "preferenze.json"), fs.readFileSync(f.sentinella));
      f.processo.emit("uncaughtException", new Error("errore processo fixture"));
      f.processo.emit("unhandledRejection", new Error("promessa fixture"));
      if (scena && !(scena instanceof Error)) await assert.rejects(handlers.get("fixture:errore")!(eventoIpc), /errore IPC fixture/);
      else assert.ok(f.eventi.includes("exit:1"));
      assert.equal(letturePreferenze, 0, "nessuna lettura preferenze per logger di prova");
      const logs = fs.readdirSync(path.join(f.paths.userData, "logs"));
      assert.equal(logs.length, 1);
      assert.match(fs.readFileSync(path.join(f.paths.userData, "logs", logs[0]), "utf8"), /fixture/);
      assert.deepEqual(fs.readdirSync(f.reale), ["clotch-sessioni"]);
      assert.deepEqual(fs.readdirSync(path.dirname(f.sentinella)), ["preferenze.json"]);
      assert.ok(f.accessi.every(p => !p.startsWith(f.reale + path.sep)));
      f.app.emit("quit");
      assert.ok(!fs.existsSync(f.temporanei[0]));
    } finally { f.cleanup(); }
  }
  console.log("PROFILE_ISOLATION_ALL_OK");
});
