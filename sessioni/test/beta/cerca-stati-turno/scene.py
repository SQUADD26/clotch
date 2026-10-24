# Scene «cst-*» degli stati del turno (cercatrice #523, giro 2). Da sessioni/: python3 test/beta/cerca-stati-turno/scene.py
import json, time
b = json.load(open('design/scene/101-15993.json'))
N = int(time.time() * 1000)
T = N - 600_000
def mk(nome, msgs, stato='lavora', adesso=None, reg=None, battito=None):
    s = json.loads(json.dumps(b))
    s['messaggi'] = {'s1': msgs}
    r = s['registro']['chat']['s1']; r['stato'] = {'lavora': 'lavora', 'finita': 'finito', 'limite': 'ferma_limite'}.get(stato, stato)
    r['battito'] = N - 60_000 if battito is None else battito
    r.update(reg or {})
    e = s['elenco']['sessioni'][0]; e['stato'] = stato if stato in ('lavora', 'aspetta', 'finita') else 'ferma'
    e['situazione'] = {'adesso': adesso or ('turno_finito' if stato == 'finita' else 'lavora'), 'strumento': None, 'inCoda': 0, 'segni': []}
    json.dump(s, open(f'design/scene/cst-{nome}.json', 'w'))
u = lambda x, d=0: {"tipo": "utente", "testo": x, "t": T + d * 1000}
a = lambda x, d=0: {"tipo": "assistente", "testo": x, "modello": "claude-opus-5-5", "t": T + d * 1000}
er = lambda x, d=0, riprova=None: {"tipo": "errore", "testo": x, "t": T + d * 1000, **({"riprova": riprova} if riprova else {})}
def st(nome, ing, es=None, i=0, d=0):
    return {"tipo": "strumento", "nome": nome, "ingresso": ing, "esito": es, "t": T + d * 1000, "id": f"t{i}"}
ok = {"testo": "ok", "errore": False}
LUNGO = "una riga molto lunga che non finisce più e va a capo da qualche parte " * 6
mk('errori', [u("Vai.", 0), a("Provo.", 1),
  er("API Error: 400 " + '{"type":"error","error":{"type":"invalid_request_error","message":"' + LUNGO + '"}}', 2),
  u("Riprova.", 3), a("Rieccomi.", 4), er("", 5, {"n": 1, "di": 10}),
  u("Ancora.", 6), er("", 7, {"n": 10, "di": 10}), er("Connessione persa", 8),
  u("E poi?", 9), er("", 10, {"n": 11, "di": 10})], 'errore', 'errore')
mk('lavoro', [u("Fai tutto.", 0),
  {"tipo": "pensiero", "testo": "Devo prima leggere i file. " * 30, "t": T + 1000},
  st("TodoWrite", {"todos": [{"content": LUNGO, "status": "completed"}, {"content": LUNGO, "status": "in_progress"}] + [{"content": f"Passo {i}", "status": "pending"} for i in range(30)]}, ok, 0, 2),
  st("Agent", {"description": "Lettore " + "x" * 120, "subagent_type": "general-purpose"}, None, 1, 3),
  st("Agent", {"description": "Altro", "subagent_type": "general-purpose"}, {"testo": "fatto", "errore": False}, 2, 4),
  st("Bash", {"command": "npm test"}, None, 3, 5)], reg={"aiutanti": {"a1": {"tipo": "general-purpose", "modello": "claude-sonnet-5-5", "testo": None, "esito": None, "finito": False}}})
mk('finito', [u("Fai.", 0)] + [st("Read", {"file_path": f"f{i}.ts"}, ok, i, 1 + i) for i in range(1200)] + [a("Finito.", 1300)], 'finita')
mk('interrotta', [u("Vai.", 0), st("Bash", {"command": "sleep 99"}, {"testo": "[Request interrupted by user for tool use]", "errore": True}, 0, 1),
  u("[Request interrupted by user for tool use]", 2), u("[Request interrupted by user]", 3), u("[Request interrupted by user]", 4),
  a("No response requested.", 5), er("No response requested.", 6), u("Ok, riprendi.", 7)], 'finita', 'interrotta')
mk('blocco', [u("Spedisci.", 0),
  st("Bash", {"command": "git push origin main"}, {"testo": "PreToolUse:Bash hook error: [~/.claude/hooks/x.py]: " + LUNGO, "errore": True}, 0, 1),
  st("mcp__x__y", {"a": "b"}, {"testo": "Permission to use mcp__x__y has been denied.", "errore": True}, 1, 2),
  st("Bash", {"command": "rm -rf /"}, {"testo": "<tool_use_error>PreToolUse:Bash hook error: [a]: no</tool_use_error>", "errore": True}, 2, 3)])
mk('compattazione', [u("Prima parte.", 0), a("Fatto.", 1),
  u("This session is being continued from a previous conversation that ran out of context. " + LUNGO, 2),
  u("Seconda parte.", 3), a("Continuo.", 4),
  u("This session is being continued from a previous conversation that ran out of context.", 5),
  u("This session is being continued from a previous conversation that ran out of context.", 6)])
mk('non-risponde', [u("Lancia.", 0), st("Bash", {"command": "npm test"}, None, 0, 1)], battito=N - 3 * 3600_000)
mk('non-risponde-giorni', [u("Lancia.", 0), st("Bash", {"command": "npm test"}, None, 0, 1)], battito=N - 5 * 86400_000)
mk('limite', [u("Vai.", 0), a("Ho finito 9.", 1), er("You've hit your session limit · resets 6pm", 2)], 'limite', 'limite',
   reg={"limite": {"account": ".claude-accountmanager", "ripartenza": N + 3600_000}})
mk('limite-senza-ora', [u("Vai.", 0), a("Ho finito.", 1)], 'limite', 'limite', reg={"limite": {"account": None, "ripartenza": None}})
mk('limite-passato', [u("Vai.", 0), a("Ho finito.", 1)], 'limite', 'limite', reg={"limite": {"account": ".claude-" + "x" * 90, "ripartenza": N - 3600_000}})
for nome, stato, adesso in [('vuoto-lavora', 'lavora', 'lavora'), ('vuoto-finita', 'finita', 'turno_finito'), ('vuoto-errore', 'errore', 'errore'),
                            ('vuoto-interrotta', 'finita', 'interrotta'), ('vuoto-limite', 'limite', 'limite'), ('vuoto-aspetta', 'aspetta', 'domanda')]:
    mk(nome, [], stato, adesso, reg={"limite": {"account": ".claude-accountmanager", "ripartenza": N + 3600_000}} if stato == 'limite' else None)
