// Giro vero produttore -> lettore (#456): il motore Python di clotch AI scrive registro e casella in una HOME temporanea,
// l'app li legge e gli manda comandi. Niente rete, voce o processi veri: dentro Python `subprocess.run` è sostituito da un finto che registra e basta.
// Il motore è quello installato (CLOTCH_MOTORE_HOOKS o ~/.claude/hooks): se manca, i test si saltano.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro, mandaComando } from "../src/clotch-ai";
import { inviaComando } from "../src/comandi";

const HOOKS = process.env.CLOTCH_MOTORE_HOOKS || path.join(os.homedir(), ".claude", "hooks");
const motore = fs.existsSync(path.join(HOOKS, "friday_registro.py")) && spawnSync("python3", ["--version"]).status === 0; // nome del protocollo del motore
const PY = String.raw`
import json, os, sys, types
from unittest.mock import patch
hooks, home, modo = sys.argv[1:4]
rc = sys.argv[4] if len(sys.argv) > 4 else "0"
os.environ.update(HOME=home, REGISTRI_PROVA='1', REGISTRI_PROVA_DIR=home, FRIDAY_REGISTRO=home+'/.claude/registro', FRIDAY_DIR=home+'/.claude/friday',  # nome del protocollo del motore
                  CASELLA_DIR=home+'/.claude/casella', OBIETTIVI_DIR=home+'/.claude/obiettivi', PYTHONDONTWRITEBYTECODE='1')
sys.dont_write_bytecode = True
sys.path.insert(0, hooks)
sys.modules['eventi_voce'] = types.SimpleNamespace(scrivi=lambda *a, **k: None)  # nessuna voce
import friday_registro as R, friday_annulla as A, obiettivo_registro as O, friday_hook as H, friday  # nome del protocollo del motore
def finto(cmd, **kw):  # l'unico "processo": registra l'argv; l'obiettivo si accetta solo per s-1; mai altro
    open(home + '/processi.log', 'a').write(json.dumps(cmd) + '\n')
    if 'obiettivo-guard.py' in cmd[1]: return types.SimpleNamespace(returncode=0 if cmd[-1] == 's-1' else 1, stdout='', stderr='')
    if cmd[0] == 'system_profiler': return types.SimpleNamespace(returncode=1, stdout='', stderr='')  # nessun microfono
    assert cmd[1].endswith('friday_fermo.py') or cmd[0] == 'echo', cmd  # nome del protocollo del motore
    return types.SimpleNamespace(returncode=int(rc), stdout='', stderr='boom')
if modo == 'produci':
    inv = [sys.executable, os.path.join(os.path.realpath(hooks), 'friday_fermo.py'), 'riprendi', 'tutto']  # nome del protocollo del motore
    R.scrivi('inizio', 's-1', {'titolo': 'Prova', 'madre': '', 'progetto': 'clotch'})
    O.imposta('s-1', 'Il pannello mostra il comando annullato entro un secondo', 'roberto')
    O.imposta('s-1', 'Il pannello mostra il comando annullato subito dopo il clic', 'roberto')
    O.scrivi({**O.leggi('s-1'), 'stato': 'raggiunto', 'prova': 'npm test verde'})
    O.imposta('s-2', 'La barra mostra tre sessioni al lavoro insieme', 'roberto')
    O.scrivi({**O.leggi('s-2'), 'stato': 'passato', 'a': 's-3', 'successore': 's-3'})
    todo = lambda *p: {'tool_name': 'TodoWrite', 'tool_input': {'todos': [{'content': t, 'status': s, 'activeForm': t} for t, s in p]}}
    H.passi('s-1', todo(('Leggere il registro', 'in_progress'), ('Scrivere il test', 'pending')))
    H.passi('s-1', todo(('Leggere il registro', 'completed'), ('Scrivere il test', 'in_progress')))
    ids = {n: A.decidi(f'Decisione {n}', 'prova', i, 's-1', 'fermo', effetto_annullo='riparte') for n, i in
           [('buona', inv), ('fallisce', inv), ('terminale', inv), ('fuori', ['echo', 'x']), ('senzaInverso', None)]}
    ids['importata'] = R.scrivi('decisione', 'friday', {'cosa': 'storica', 'perche': 'x', 'inverso': inv, 'chat': '', 'genere': 'altro', 'non_annullabile': '', 'effetto_annullo': ''})['id']  # nome del protocollo del motore
    print(json.dumps(ids))
elif modo == 'daemon':
    with patch('subprocess.run', finto): friday.comandi()  # nome del protocollo del motore
elif modo == 'terminale':
    with patch('subprocess.run', finto): print(json.dumps(A._annulla(sys.argv[5])))
`;
const py = (h: string, modo: string, ...a: string[]) => {
  const r = spawnSync("python3", ["-I", "-c", PY, HOOKS, h, modo, ...a], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const casella = (h: string) => path.join(h, ".claude", "casella", "comandi");
const processi = (h: string) => { try { return fs.readFileSync(path.join(h, "processi.log"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
/** Manda un comando e fa girare la clotch AI vera (un giro di casella) appena il file compare. */
async function manda(h: string, cmd: any, args: Record<string, unknown>, rc = "0") {
  const p = inviaComando(h, cmd, args, { ogniMs: 20, scadenzaMs: 20_000 });
  while (!fs.existsSync(casella(h)) || !fs.readdirSync(casella(h)).some((n) => n.endsWith(".json"))) await new Promise((ok) => setTimeout(ok, 10));
  py(h, "daemon", rc);
  return p;
}
const dec = (h: string, id: string) => leggiRegistro(h).decisioni.find((d) => d.id === id)!;

test("giro vero: il motore scrive, l'app legge obiettivi, passi e decisioni", { skip: !motore && "motore clotch AI non installato" }, () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "integrato-"));
  const ids = JSON.parse(py(h, "produci"));
  const r = leggiRegistro(h);
  const s1 = r.chat.get("s-1")!;
  assert.deepEqual([r.errori.length, s1.titolo, s1.progetto], [0, "Prova", "clotch"]);
  assert.deepEqual(s1.obiettivo, { stato: "raggiunto", testo: "Il pannello mostra il comando annullato subito dopo il clic" });
  assert.equal(r.chat.get("s-2")!.obiettivo!.stato, "passato");
  assert.deepEqual(s1.passi, [{ testo: "Leggere il registro", stato: "completed" }, { testo: "Scrivere il test", stato: "in_progress" }]);
  const per = (n: string) => r.decisioni.find((d) => d.id === ids[n])!;
  assert.deepEqual(["buona", "terminale", "fuori", "senzaInverso", "importata"].map((n) => per(n).annullabile), [true, true, true, false, false]);
  console.log(`INTEGRATO_LETTORE_OK decisioni=${r.decisioni.length} obiettivo=${s1.obiettivo!.stato} passi=${s1.passi.length}`);
});

test("giro vero: annulla, doppio clic, rifiuti e errori del motore, riavvio", { skip: !motore && "motore clotch AI non installato" }, async () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "integrato-"));
  const ids = JSON.parse(py(h, "produci"));
  const [a, b] = await Promise.all([manda(h, "annulla", { decisione: ids.buona }), inviaComando(h, "annulla", { decisione: ids.buona })]);
  assert.deepEqual([a.esito, b.id, b.esito], ["ok", a.id, "ok"]); // doppio clic: un comando, un esito
  console.log(`INTEGRATO_ANNULLA_OK comando=${a.id} testo="${a.testo}" inverso_eseguito=${processi(h).length}`);
  assert.equal(processi(h).length, 1);
  assert.deepEqual([dec(h, ids.buona).annullata, dec(h, ids.buona).annullabile], [true, false]);
  const ancora = await manda(h, "annulla", { decisione: ids.buona }); // già annullata: il motore rifiuta, l'inverso non rigira
  assert.deepEqual([ancora.esito, processi(h).length, dec(h, ids.buona).annullata], ["rifiutato", 1, true]);
  const f = await manda(h, "annulla", { decisione: ids.fallisce }, "1"); // inverso fallito: errore, si può riprovare
  assert.deepEqual([f.esito, dec(h, ids.fallisce).annullabile], ["errore", true]);
  const fuori = await manda(h, "annulla", { decisione: ids.fuori }); // inverso fuori dai comandi ammessi: rifiutato, non si ripropone
  assert.deepEqual([fuori.esito, dec(h, ids.fuori).annullabile, processi(h).length], ["rifiutato", false, 2]);
  const imp = await manda(h, "annulla", { decisione: ids.importata }); // senza ricevuta
  assert.deepEqual([imp.esito, processi(h).length], ["rifiutato", 2]);
  assert.equal((await manda(h, "annulla", { decisione: "r-000000000000" })).esito, "rifiutato");
  assert.equal(JSON.parse(py(h, "terminale", "0", ids.terminale))[0], "ok"); // annullata dal terminale
  assert.deepEqual([dec(h, ids.terminale).annullata, dec(h, ids.terminale).annullabile], [true, false]);
  // s-1 non è archiviata: rifiutata sia dal motore vecchio («sconosciuto», che archiviate.tsx riconosce) sia da quello con «ripristina» (claude-config#2513)
  const ripr = await manda(h, "ripristina", { chat: "s-1" });
  assert.deepEqual([ripr.esito, /sconosciuto|non e' archiviata|non è archiviata|non del motore/i.test(ripr.testo)], ["rifiutato", true], ripr.testo);
  const senza = await manda(h, "manda", { chat: "s-1" });
  assert.deepEqual([senza.esito, /test/.test(senza.testo ?? "")], ["rifiutato", true], senza.testo); // il testo esatto è del motore installato e cambia fra versioni
  assert.equal((await manda(h, "obiettivo", { chat: "s-1", esito: "accetta" })).esito, "ok");
  assert.equal((await manda(h, "obiettivo", { chat: "s-9", esito: "accetta" })).esito, "rifiutato"); // nessuna proposta
  const prima = JSON.stringify([...leggiRegistro(h).esiti]);
  py(h, "daemon"); // clotch AI riavviata: stessi file, niente rieseguito
  assert.deepEqual([JSON.stringify([...leggiRegistro(h).esiti]), processi(h).filter((p) => p[0] !== "echo" && p[1].endsWith("friday_fermo.py")).length], [prima, 3]); // nome del protocollo del motore
  assert.deepEqual(fs.readdirSync(casella(h)).filter((n) => n.endsWith(".json")), []);
});

test("giro vero: comando vecchio, impostazioni e account non disponibile", { skip: !motore && "motore clotch AI non installato" }, async () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "integrato-"));
  const ids = JSON.parse(py(h, "produci"));
  mandaComando(h, "annulla", { decisione: ids.buona }, Date.now() - 2 * 3600_000); // scritto 2 ore fa: il motore lo rifiuta senza eseguirlo
  py(h, "daemon");
  const vecchio = [...leggiRegistro(h).esiti.values()];
  assert.deepEqual(vecchio.map((e) => e.esito), ["rifiutato"]);
  assert.match(vecchio[0].testo, /scaduto/i);
  assert.deepEqual([processi(h).length, dec(h, ids.buona).annullabile], [0, true]); // ritentare ha senso
  const acc = await manda(h, "imposta", { chiave: "account", valore: "account-che-non-esiste" });
  assert.equal(acc.esito, "rifiutato");
  assert.notEqual(acc.testo, "");
  const voce = await manda(h, "imposta", { chiave: "legge_ad_alta_voce", valore: "mai" });
  assert.equal(voce.esito, "ok");
  assert.equal(leggiRegistro(h).impostazioni?.legge_ad_alta_voce, "mai");
});
