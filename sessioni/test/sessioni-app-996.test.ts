// #996: le sessioni dell'app Claude portano l'account nel percorso (claude-code-sessions/<uuid>/<org>/): l'email viene dal .claude.json con quell'uuid.
import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { leggiElenco } from "../src/elenco";
import { leggiPagina } from "../src/messaggi";
import { quoteConGiorni, quoteUso, svuotaCache } from "../src/quote-uso";
import { trovaRadici } from "../src/radici";

const scrivi = (f: string, c: string) => { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, c); };

test("#996: profilo dell'app Claude -> uuid -> email -> uso; trascrizione copiata o su un altro computer", async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "clotch-996-"));
  try {
    const account = (cartella: string, uuid: string, email: string) =>
      scrivi(path.join(home, cartella, ".claude.json"), JSON.stringify({ oauthAccount: { accountUuid: uuid, emailAddress: email } }));
    account(".claude", "uuid-base", "base@x.it");
    account(".claude-terminal-dentalspace", "uuid-dental", "dental@x.it");
    mkdirSync(path.join(home, ".claude", "projects"), { recursive: true });
    mkdirSync(path.join(home, ".claude-terminal-dentalspace", "projects"), { recursive: true });
    assert.deepEqual(trovaRadici(home).map((r) => [r.account, r.email, r.uuid]), [[".claude", "base@x.it", "uuid-base"], [".claude-terminal-dentalspace", "dental@x.it", "uuid-dental"]]);

    const desc = (profilo: string, uuid: string, id: string, extra: object = {}) =>
      scrivi(path.join(home, "Library", "Application Support", profilo, "claude-code-sessions", uuid, "org", `local_${id}.json`),
        JSON.stringify({ sessionId: `local_${id}`, cliSessionId: id, title: id, cwd: "/work/x", lastActivityAt: 1, sshConfig: { sshHost: "sandbox@1.2.3.4" }, ...extra }));
    desc("Claude-dentalspace", "uuid-dental", "remota"); // nessuna trascrizione sul Mac: l'host ce l'ha
    desc("Claude-dentalspace", "uuid-ignoto", "senza-email"); // account senza .claude.json sul Mac: niente email inventata
    desc("Claude", "uuid-dental", "copiata"); // il CLI scrive in ~/.claude, ma la sessione è dell'account dentalspace
    scrivi(path.join(home, ".claude", "projects", "ssh-copiata", "copiata.jsonl"),
      JSON.stringify({ type: "user", cwd: "/work/x", message: { role: "user", content: "ciao" }, timestamp: "2026-10-24T10:00:00Z" }) + "\n");

    const per = new Map(leggiElenco({ home, conProve: true }).sessioni.map((s) => [s.id, s]));
    assert.deepEqual([per.get("remota")!.account, per.get("remota")!.email], ["Claude-dentalspace", "dental@x.it"]);
    assert.equal(per.get("senza-email")!.email, null);
    assert.equal(per.get("copiata")!.email, "dental@x.it", "l'uuid della sessione vince sulla cartella dove scrive il CLI");

    // l'uso: l'email della sessione trova la riga del feed
    const adesso = Date.now() / 1000;
    svuotaCache();
    await quoteUso(Date.now(), async () => ({ rows: [{ email: "dental@x.it", host: os.hostname(), ts: adesso - 5, five_used: 12, five_resets: adesso + 3600, seven_used: 20, seven_resets: adesso + 86_400 }] }));
    const q = (await quoteConGiorni(trovaRadici(home), Date.now(), async () => new Map())).find((x) => x.email === per.get("remota")!.email);
    assert.equal(q?.sette, 20);

    // trascrizione: copiata si legge; la remota no, e lo dice
    assert.equal(leggiPagina(per.get("copiata")!, 0).messaggi.length, 1);
    assert.equal(leggiPagina(per.get("remota")!, 0).errore, "trascrizione non trovata sul disco");
  } finally { svuotaCache(); rmSync(home, { recursive: true, force: true }); }
});
