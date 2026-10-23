# Catalogo delle situazioni di una sessione (#338)

Ogni riga: una situazione in cui può trovarsi una sessione di lavoro, da dove la si legge, cosa mostra l'app Sessioni, e il test.

- **Fonte:** `CLI` (Claude Code nel terminale), `App` (app Claude desktop, stessa trascrizione + `local_*.json`), `Codex`, `Cursor`, `Friday` (registro `~/.claude/registro/AAAA-MM.jsonl`, contratto v1 in claude-config `global/hooks/friday/CONTRATTO.md`, ramo `feat/2479-motore-friday`).
- **Trascrizione:** riconosciuta da `src/situazione.ts` (`Sessione.situazione`: `adesso`, `strumento`, `inCoda`, `segni`). Fixture vere anonimizzate in `test/fixtures/situazioni/{claude,codex}/` (`test/anonimizza.mjs`), test in `test/situazioni-trascrizioni.test.ts`.
- **Friday:** letto da `src/friday.ts` (`leggiRegistro`); comandi con `mandaComando` (un file in `~/.claude/casella/comandi/`, `.tmp` poi rename). Fixture costruita dal contratto (il registro sul Mac non esiste ancora) in `test/fixtures/situazioni/friday/`, test in `test/situazioni-friday.test.ts`.
- **App mostra:** frame della sezione «Chat al lavoro» della pagina Figma «Sessioni» (101:13613), dove c'è.
- **Esito:** `fatto` = test verde su dati veri; `contratto` = test verde su righe del contratto Friday (nessun dato vero ancora); `attende` = test segnato `todo`, mai verde finto.

## Situazioni

| # | Situazione | Fonte | Come si riconosce nei dati | Cosa mostra l'app | Friday (registro) | Esito |
|---|---|---|---|---|---|---|
| 1 | Al lavoro | CLI, App | ultimo `tool_use` senza `tool_result` (`adesso: lavora`, `strumento`) | «In corso», riga dello strumento in esecuzione, «Ragionando…» (101:14396) | `battito {stato: lavora}` | fatto · `claude/al-lavoro` · contratto |
| 1b | Al lavoro | Codex | `event_msg task_started` senza `task_complete` | come sopra | fuori v1 | fatto · `codex/al-lavoro` |
| 2 | Permesso da dare | CLI, App | **non è nella trascrizione**: resta solo il `tool_use` aperto; oggi solo `sessioni-stato` «Chiede il permesso» e il socket di Clotch | «In attesa di te», «Permesso richiesto, da 2 min», comando, Consenti / Consenti sempre / Nega (101:13650) | `richiesta {genere: permesso, rid, strumento, ingresso}`; chiusa da `richiesta_chiusa`; comando `rispondi_permesso` | contratto |
| 2b | Permesso dato a mano | CLI, App | `permissionDecision.source` = `user_temporary` / `user_permanent` | riga dello strumento normale | `richiesta_chiusa {esito: consenti / consenti_sempre}` | fatto · `claude/permesso-dato-a-mano` |
| 2c | Permesso negato da te | CLI, App | `toolDenialKind: user-rejected`, poi «[Request interrupted by user for tool use]» | «Interrotta da te» | `richiesta_chiusa {esito: nega}` | fatto · `claude/rifiutata-da-te` |
| 2d | Codex: permesso | Codex | **non esiste** nei dati veri (solo `approval_policy` in `turn_context`) | — | fuori v1 | attende (non c'è) |
| 3 | Domanda per te | CLI, App | `tool_use AskUserQuestion` senza esito (`adesso: domanda`) | «Domanda per te, da 5 min», opzioni, Rispondi / Salta (101:13896) | `richiesta {genere: domanda, domande}`; comandi `rispondi_domanda`, `salta_domanda` | fatto · `claude/domanda-aperta` · contratto |
| 3b | Domanda scaduta (nessuno ha risposto) | CLI, App | `tool_result` di AskUserQuestion «No response after 600s» | la domanda sparisce, nota «scaduta» | `richiesta_chiusa {esito: scaduta}` | fatto · `claude/domanda-scaduta` |
| 3c | Domanda | Codex | `function_call request_user_input_async` senza output | come 3 | fuori v1 | fatto · `codex/domanda-aperta` |
| 3d | Domanda dichiarata a fine turno | Friday | `stato {stato: serve_roberto, domanda}` | «In attesa di te» con la domanda | `stato serve_roberto` | contratto |
| 4 | Piano da approvare | CLI, App | `tool_use ExitPlanMode` senza esito (`adesso: piano`) | «Piano, 4 passi», Approva / Modifica (101:14132) | `richiesta {genere: piano}`; comando `piano {esito: approva / modifica}` | fatto · `claude/piano-aperto` · contratto |
| 4b | Piano approvato | CLI, App | `tool_result` di ExitPlanMode senza errore («User has approved your plan») | «Piano approvato» | `richiesta_chiusa {esito: approva}` | fatto · `claude/piano-approvato` |
| 4c | Piano rifiutato | CLI, App | nessun esempio vero sul Mac (40 giorni, 9 radici) | «Modifica» | `richiesta_chiusa {esito: modifica}` | attende dati veri |
| 5 | Aiutanti al lavoro | CLI, App | `tool_use Agent` aperto (`adesso: aiutanti`); file `subagents/agent-*.jsonl` | «3 aiutanti al lavoro» con nome, cosa fa, tempo (101:14396) | `aiutante {fase: inizio}` | fatto · `claude/aiutante-al-lavoro` · contratto |
| 5b | Aiutante in background | CLI, App | esito «Async agent launched successfully» (segno `aiutanti`) | come sopra | `aiutante` | fatto · `claude/aiutante-in-background` |
| 5c | Aiutanti finiti | Friday | `aiutante {fase: fine, esito}` | «3 aiutanti finiti» con esito (101:15335) | `aiutante` | contratto |
| 5d | Aiutanti | Codex | `spawn_agent`, `SubAgentActivity` | come 5 | fuori v1 | fatto · `codex/aiutanti` |
| 6 | Modifica con differenze | CLI, App | `toolUseResult.structuredPatch` di Edit / Write | «Modificato <file> +4 −2» con righe tolte e aggiunte (101:14631) | — (solo trascrizione) | fatto · `claude/modifica-con-differenze` |
| 6b | Modifica | Codex | `item_completed FileChange {changes: {<file>: {type, unified_diff}}}` | come 6 | fuori v1 | fatto · `codex/modifica-con-differenze` |
| 7 | Messaggi in coda | CLI, App | `queue-operation enqueue` non ancora `dequeue`/`remove` (`inCoda`) | «1 messaggio in coda», ↵ / ⌘↵ (101:14849, 101:43708, 101:43945) | `coda {voci}`; comandi `manda {modo: coda}`, `coda_modifica`, `coda_togli` | fatto · `claude/messaggio-in-coda`, `claude/coda-consumata` · contratto |
| 7b | Manda subito (interrompe) | App | — | «Interrotta da te» + messaggio nuovo (101:43535) | comando `manda {modo: subito}` | contratto |
| 7c | Coda | Codex | **non esiste** nei dati veri | — | fuori v1 | attende (non c'è) |
| 8 | Interrotta da te | CLI, App | testo «[Request interrupted by user for tool use]» (`adesso: interrotta`) | «Interrotta da te», stato «Ferma» (101:15055) | `interrotta {da: roberto}`; comando `interrompi` | fatto · `claude/rifiutata-da-te` · contratto |
| 8b | Interrotta a metà strumento (sessione chiusa) | CLI, App | `toolDenialKind: interrupted`, «[Tool call interrupted…», poi «No response requested.» | «Interrotta» | `interrotta` | fatto · `claude/interrotta-a-meta-strumento` |
| 8c | Interrotta senza strumento in corso | CLI, App | testo «[Request interrupted by user]» | «Interrotta da te» | `interrotta` | fatto · `claude/interrotta-senza-strumento` |
| 8d | Interrotta | Codex | `turn_aborted {reason: interrupted}` | come 8 | fuori v1 | fatto · `codex/interrotta` |
| 9 | Turno finito | CLI, App | ultima riga assistant di solo testo (`end_turn` o `stop_sequence`), poi `system stop_hook_summary` | «Finita in 4 min 12 s · 18 strumenti · 3 file · 2 aiutanti» (101:15335) | `stato {stato: finito, prova}` | fatto · `claude/turno-finito` · contratto |
| 9b | Turno finito | Codex | `task_complete` senza `error` | come 9 | fuori v1 | fatto · `codex/turno-finito` |
| 9c | Aspetta qualcosa | Friday | `stato {stato: aspetta, aspetto}` (anche `aspetto figlia <id>`) | «Aspetta: <cosa>» | `stato aspetta` | contratto |
| 10 | Ricerca sul web | CLI, App | `tool_use WebSearch` / `WebFetch` | «Cercato sul web: …, 4 fonti» (101:15577) | — | fatto · `claude/ricerca-web` |
| 10b | Ricerca sul web | Codex | `item_completed Extension {kind: web.search}` | come 10 | fuori v1 | fatto · `codex/ricerca-web` |
| 11 | Bloccata da un hook | CLI, App | `tool_result` «PreToolUse:… hook error», `permissionDecision.source: hook` | «Bloccato da una regola: … La sessione prova un'altra strada» (101:15790) | `rifiuto {regola, strumento, testo}` | fatto · `claude/bloccata-da-hook`, `claude/bloccata-da-hook-mcp` · contratto |
| 11b | Negata da una regola dei permessi | CLI, App | `toolDenialKind: permission-rule`, «Permission to use … », source `config`/`user_reject` | come 11 | `rifiuto` | fatto · `claude/negata-da-regola` |
| 11c | Rifiutata dalla regola di stato | Friday | `rifiuto {regola: stato-dichiarato}` | come 11 | `rifiuto` | contratto |
| 12 | Non risponde | Friday | stato `lavora` e nessun `battito` da 180 s (stessa soglia per app e Friday) | «La sessione non risponde. Nessun segnale da 6 min», «Apri nel terminale» (101:15993) | `battito` | contratto |
| 13 | Limite d'uso | Friday | `stato {stato: ferma_limite, account, riparte_alle}` | «Limite di uso raggiunto. L'account … riparte alle 18:00», casella «Riparte alle 18:00» (101:16211) | `ferma_limite`; comando `riprendi_altrove` | contratto |
| 13b | Limite d'uso | Codex | `task_complete {error: {codex_error_info: usage_limit_exceeded}}`, `token_count rate_limits.primary.used_percent: 100` | come 13 | fuori v1 | fatto · `codex/limite-uso` |
| 13c | Limite d'uso nella trascrizione | CLI, App | assistant `isApiErrorMessage: true`, `error: rate_limit`, «You've hit your session limit · resets …» (`adesso: limite`) | come 13 | `ferma_limite` | fatto · `claude/limite-uso` |
| 14 | Errore API | CLI, App | assistant `isApiErrorMessage: true` («API Error …», `error: invalid_request`) | riga di errore rossa | `errore` | fatto · `claude/errore-api` |
| 14b | Errore di rete, riprova | CLI, App | `system api_error {retryAttempt, maxRetries, connection.code}` (`adesso: riprova`) | «Riprovo (1 di 10)» | — | fatto · `claude/errore-rete-riprova` |
| 14c | Errore di un hook o di Friday | Friday | `errore {dove, testo}` | avviso di errore | `errore` | contratto |
| 14d | Errore | Codex | `task_complete {error}`; comando fallito `CommandExecution {status: failed}` | come 14 | fuori v1 | fatto · `codex/errore-turno`, `codex/comando-fallito` |
| 15 | Bloccata (dichiarato) | Friday | `stato {stato: bloccato, dettaglio: BLOCCATO: …}` | «Bloccata: <perché>» | `stato bloccato` | contratto |
| 15b | Serve la madre | Friday | `stato {stato: serve_madre}` | «Aspetta la sessione madre» | `stato serve_madre` | contratto |
| 16 | Sessione figlia | CLI, App | primo messaggio con «Background (from the session that started this one)», `turnOrigin: sdk` | sotto la madre, con il suo titolo | `inizio {madre}` | fatto · `claude/sessione-figlia` · contratto |
| 16b | Messaggio da un'altra sessione | CLI, App | `turnOrigin: peer`, testo con `<cross-session-message` | «Messaggio da <sessione>» | — | fatto · `claude/messaggio-da-altra-sessione` |
| 17 | Handoff | Friday | `fine {motivo: handoff, chat_nuova}` e `inizio {da_handoff}` | la vecchia rimanda alla nuova | `fine`, `inizio` | contratto |
| 18 | Compattazione | CLI, App | `system compact_boundary {compactMetadata.trigger: auto}` + riga `isCompactSummary` | «Conversazione riassunta per fare spazio» (101:15335) | `compattazione {come}` | fatto · `claude/compattazione` · contratto |
| 18b | Compattazione | Codex | `compacted` + `item_completed ContextCompaction` | come 18 | fuori v1 | fatto · `codex/compattazione` |
| 19 | Più account | CLI, App, Friday | radici `~/.claude`, `~/.claude-*` (9 sul Mac); profili app `Claude*` (8) | account nell'intestazione | `inizio {account, sorgente}` | fatto (`lettura.test.ts`) · contratto |
| 20 | Sessione archiviata | App, Friday | `local_*.json isArchived: true` | stato «Finita» | `fine {motivo: archiviata}`; comando `archivia` | fatto (`lettura.test.ts`) · contratto |
| 21 | Transcript corrotto o troncato | tutte | riga rotta o tagliata a metà: si salta la riga, non la sessione | la sessione resta, senza quella riga | — | fatto (`casi-limite.test.ts`, `situazioni-trascrizioni`) |
| 22 | Sessione cancellata mentre la guardi | tutte | il file sparisce: esce dall'elenco, `leggiPagina` dà «file sparito» | la sessione sparisce, nessun errore | — | fatto (`casi-limite.test.ts`, `situazioni-trascrizioni`) |
| 23 | Eventi persi | Friday | buco nella numerazione `n` della chat | avviso «eventi persi» | campo `n` | contratto |
| 24 | Chat chiusa | Friday | `fine {motivo}` | stato «Finita» | `fine` | contratto |
| 25 | Chat fermata / Ferma tutto | Friday | `fermo {ambito: chat / tutto, acceso}` | «Ferma», pulsante «Ferma tutto» acceso | `fermo`; comandi `ferma_tutto`, `riprendi_tutto`, `ferma_chat`, `riprendi_chat` | contratto |
| 26 | Quarantena | Friday | `quarantena {chat, perche, acceso}` | «In quarantena: <perché>» | `quarantena`; comando `quarantena {azione}` | contratto |
| 27 | Decisione di Friday annullabile | Friday | `decisione {inverso}`; annullata da `comando annulla` + `comando_fatto ok` | elenco decisioni con «Annulla» | `decisione`; comando `annulla` | contratto |
| 28 | Esito di un comando dell'app | Friday | `comando_fatto {comando, esito: ok / rifiutato / errore}` | conferma o errore col perché | `comando_fatto` | contratto |
| 29 | Obiettivo cambiato | Friday | `obiettivo {stato, testo}` (la fonte resta `~/.claude/obiettivi/`) | pannello «Obiettivo» | `obiettivo` | contratto |
| 30 | Chat Friday | Friday | `chat: friday`; Roberto scrive con il comando `parla`, Friday risponde con `avviso {motivo: risposta}` (diverso da `domanda`, che è una sessione che chiede a Roberto) | «Friday / Sempre attiva» (101:16432) | `parla`, `avviso` | contratto (comando) |
| 31 | Non disturbare | Friday | comando `non_disturbare {acceso, minuti}` | «Non disturbare» acceso | comando | contratto |
| 32 | Cursor: tutte | Cursor | nessuna trascrizione Cursor sul Mac | — | fuori v1 | attende dati veri |
| 33 | App desktop «in corso» | App | il file vero **non ha `isRunning`** (chiavi viste: `completedTurns`, `latestUserFrameAt`, `interruptedAwaitingPerson`…): `desktop.ts` non lo vede mai | «In corso» | `battito` (Friday lo copre) | attende (difetto di #334: issue #340) |

## Clotch installato o assente

Roberto: «ci sono delle robe che devono passare per Clutch se uno installa anche Clutch». Contratto v1, sezione 4: l'app sa se Clotch è acceso dall'ultimo evento `clotch` (più vecchio di 10 minuti = spento).

| Funzione | Clotch installato e acceso | Clotch assente o spento | Esito |
|---|---|---|---|
| Voce che parla (avvisi) | `avviso {detto_da: clotch}`: lo dice Clotch, l'app lo mostra e basta | `avviso {detto_da: app}`: l'app lo mostra e lo legge | contratto |
| Dettatura | Clotch manda il testo come `manda` / `parla` con `da: clotch` | l'app detta da sé e manda lo stesso comando con `da: app` | contratto (comando) |
| Indicatore «parla» / «ascolta» | `clotch {voce, parla, ascolta}` | nessun indicatore | contratto |
| Permessi, domande, piani | risponde chi arriva primo (app, Clotch, Friday); `richiesta_chiusa {da}` dice all'altra di toglierla | risponde solo l'app | contratto |
| Chat aperte a mano nell'app Claude | Friday passa il comando a Clotch | `comando_fatto {esito: rifiutato}` col perché | contratto |
| Obiettivi | Clotch mostra la scheda; Accetta/Rifiuta da Clotch | l'app mostra il pannello dal registro | contratto |
| Quota e account | Clotch legge la quota (keychain); l'app non rifà la chiamata | l'app mostra solo `ferma_limite` | attende formato Friday (nessun evento quota nella v1) |
| Push sul telefono, AFK, companion ESP32/Apple | solo Clotch | niente | fuori dall'app |

## Comandi dell'app (casella)

`ferma_tutto`, `riprendi_tutto`, `ferma_chat`, `riprendi_chat`, `non_disturbare`, `annulla`, `regola`, `parla`, `quarantena`, `rispondi_permesso`, `rispondi_domanda`, `salta_domanda`, `piano`, `manda` (`subito` / `coda`), `coda_modifica`, `coda_togli`, `interrompi` (come Esc: la chat resta viva; `ferma_chat` invece blocca ogni strumento finché `riprendi_chat`), `riprendi_altrove`, `archivia`. Un nome fuori elenco: `mandaComando` lo rifiuta prima di scrivere.

## Accordo con Friday

- «★ Friday: casella e sandbox», 23/10: formato non ancora fissato; lo fissa «⚙︎ Friday: costruzione del motore»; «Il tuo catalogo delle situazioni serve proprio a fissare i nomi».
- «⚙︎ Friday: costruzione del motore», 23/10: «Contratto Friday v1 aggiornato con tutti i 23 punti (commit 7158fad1 …)». «Non risponde = stato lavora e nessun battito da 180 s». «Codex e Cursor fuori dalla v1».
- Il contratto è sul ramo `feat/2479-motore-friday`, non ancora unito: se cambia, si aggiornano `src/friday.ts` e la fixture Friday.

## Difetti trovati nella lettura dati di #334

- `desktop.ts` legge `isRunning`, che i file veri non hanno: «in corso» dall'app non scatta mai (riga 33, issue #340).
- I rollout Codex scrivono quasi tutto in `event_msg item_completed` (CommandExecution, FileChange, McpToolCall…): `ConvertitoreCodex` legge solo `response_item`, quindi nei messaggi mancano modifiche e ricerche (issue #341). La situazione le vede (`situazioneCodex`).

## Prove di collegamento dal vivo

Roberto: «Assicuratevi di condurre i dovuti test prima dell'integrazione app <> claude p <> clotch etc Così da gestire tutto e fare una bella integrazione».

`cd sessioni && npm run prove [-- claude|friday|clotch|codex]` (`src/prove-collegamento.ts`): legge i dati veri della macchina e stampa per ogni prova `VERDE`, `FALLITA` o `ATTESA` col perché. Uscita 0 solo se tutte verdi, 1 se una è fallita, 3 se qualcuna è in attesa. Nessuna prova in attesa conta come verde.

| Coppia | Prova | Dove gira |
|---|---|---|
| app <> Claude CLI | il lettore vede le sessioni vere, ognuna con la situazione | Mac |
| app <> app Claude | il lettore vede le sessioni dell'app | Mac |
| app <> Claude (sessione vera) | tre `claude -p` di prova, uno alla volta: turno finito, modifica con differenze, permesso negato; il lettore le riconosce | squaddv2 (sul Mac è vietato, #1797) |
| app <> Friday | legge il registro vero; un comando con nome fuori elenco nella casella torna come `comando_fatto rifiutato` entro 30 s | Mac, solo con il motore acceso (`friday {evento: avvio}`) |
| app <> Clotch | acceso o spento dal registro (confrontato col file della voce), `avviso.detto_da`, dettatura da Clotch, obiettivi dalla stessa fonte, Clotch spento | Mac |
| app <> Codex | il lettore vede tutti i rollout veri; sessione vera di prova | Mac |

Esito sul Mac, 23/10: `verdi 5 · fallite 1 · in attesa 6`. Fallita: l'ultimo avviso del registro non ha `detto_da` (contratto v1). In attesa: sessione Claude vera (va su squaddv2), motore Friday spento, Clotch non scrive l'evento `clotch` né usa la casella, prova con Clotch spento, `codex` non installato.
