# Clotch: regole per Claude

Prima di tutto `ARCHITECTURE.md` (cosa fa l'app, dove gira, come si compila).

## Interfaccia -> Figma (claude-config#1942, regola S-0088 di Roberto)

Ogni UI passa prima da Figma, approvata da Roberto; solo dopo si scrive il codice. Skill `figma-ui-design`, fase 10 «Dal disegno al codice».

- **File Figma:** «Clotch», `https://www.figma.com/design/gayvkX0IaLjZghH2otVbJt/Clotch`. Si scrive solo col ponte figma-console; per il codice si legge con `leggi-frame.js` ed `esporta-token.js` della skill (niente MCP Figma ufficiale).
- **Ogni file di interfaccia nuovo o rifatto** ha nelle prime righe `// figma: <node-id>` del frame approvato. Lo Stop hook `parita-fine-turno.py` non chiude il turno senza la prova di parità di quel file.
- **Pronto per il codice, prima di scrivere:** `controlla-ui.js` con `PER_IL_CODICE = true` sul frame torna `[]` (ogni numero è una variabile, auto layout, nomi con scopo, frame «Varianti» con tutti gli stati). Se no, si sistema il file Figma, non il codice.
- **Token: solo da Figma.** `esporta-token.js` -> `design/tokens.json` -> `node scripts/token-swift.mjs` -> `Sources/Clotch/FigmaTokens.swift` (generato, mai a mano; `test-goals-linux.sh` lancia `--check`). Nel codice di un file con `// figma:` nessun valore a mano: colori, misure, raggi, opacità e font vengono da `FigmaToken`. Un valore nuovo nasce come variabile in Figma, poi si riesporta. `NotchTokens.swift` è il vecchio file a mano: i suoi valori passano a `FigmaToken` quando il file Figma ha le variabili del notch.
- **Parità, nel rapporto con le righe di esito:** dati del frame in `design/figma/<node-id>.json` (`leggi-frame.js`) e `design/figma/<node-id>.png` (export del nodo a scala 1), poi
  - `node ~/.claude/skills/figma-ui-design/parita.mjs token design/figma/<id>.json design/tokens.json <file Swift>`
  - un test su richiesta che disegna la vista a scala 1 (modello: `Tests/ClotchTests/AdhdParityTests.swift`) e `parita.mjs immagine design/figma/<id>.png design/app/<id>.png --soglia 0.08`
  - cancello: «errori gravi: 0» in tutti e due. Al massimo 3 giri di correzione, poi si scrive a Roberto cosa non torna.
- **Compilare:** solo sul Mac (la sandbox Linux non compila l'app). Una sessione nella sandbox prepara il ramo e manda alla master «pronto da compilare clotch <sha>».
- **Code Connect:** non per Clotch finché la prova della scheda ADHD (#123) non è chiusa.
