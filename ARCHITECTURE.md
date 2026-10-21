# Architecture — goal-notch

## What the project is
A macOS notch app that shows only the goals of Roberto's master Claude sessions and whether each goal is getting closer (issue #1). It is a fork of CodeIsland (MIT, Swift): the notch shell, window and open/close motion come from CodeIsland; the content is replaced by the goal list. Display name `Goal Notch`, bundle id `com.squadd.goalnotch`.

## Backend and where it runs
No backend. The app runs on Roberto's Mac only and reads local files, read-only. Its only write is its own cache, `~/Library/Application Support/Goal Notch/sessions-v<N>.json` (stat and parsed fields of each session file, so a restart re-parses only changed files; safe to delete). One exception, on Roberto's click: «Accetta» on a proposed goal (issue #20) runs `python3` with claude-config's own `obiettivo_registro.conferma(cli, text)` from `~/.claude/hooks` (the function behind his «sì»), which signs the goal «da roberto» in `~/.claude/obiettivi/` (`CodeIslandCore/GoalDecision.swift`). «Rifiuta» runs `~/.claude/hooks/obiettivo-guard.py rifiuta --sessione <cli>` (claude-config#1807) and hides the proposal at once through UserDefaults `goalnotch.rejectedProposals`. Otherwise it writes nothing into `~/.claude`, `~/.codex` or other agent configs (CodeIsland's hook installer, hook socket server, agent watchers and companion bridges are not started at launch).

## Data the app reads (all on the Mac, read-only)
| What | Path | Written by |
|---|---|---|
| Goals register, one file per master session | `~/.claude/obiettivi/<cli>.json` (`cli`, `obiettivo`, `stato` aperto/proposto/raggiunto/bloccato/passato, `prova`, `t`, `titolo`, `prove` = `[{testo, fatta, t}]` when present, `proposta.testo` = a proposal beside the open goal) | claude-config `global/hooks/obiettivo_registro.py` |
| Desktop app sessions | `~/Library/Application Support/[Cc]laude*/claude-code-sessions/**/local_*.json` (only these top-level keys are parsed, the rest is skipped: `sessionId`, `cliSessionId`, `spawnedFrom`, `priorRemoteCliSessionIds`, `scheduledTaskId`, `title`, `isRunning`, `isArchived`, `lastActivityAt`, `prs`) | Claude desktop app |
| Live subagents per session | `~/.claude/handoff/live/<cli>.json` (`agenti`, `aggiornato`) | claude-config `global/hooks/live_state.py` |
| Accounts in use on this Mac | running apps (`NSWorkspace.runningApplications`): bundle `Claude <email>.app` (full-width ＠ in the name), matched to the dashboard row by exact email; updated on app launch/quit notifications only | each account's Claude desktop app |
| Roberto's requests | `~/.claude/richieste/<id>.json` (`id`, `t`, `testo`, `stato` nuova/presa/fatta, `t_presa`, …); the folder arrives with a claude-config promotion, until then the plate says so | claude-config (Overseer) |
| Overseer voice state (issue #10) | `~/.config/voce/stato.json` (`v`, `parla`, `t_inizio`/`t_fine` epoch ms, `passo_ms`, `livello` = volume 0…1 per step, computed from the mp3 before it plays); contract in `CodeIslandCore/NotchVoice.swift`; FSEvents file events on `~/.config`, no polling | claude-config Clean View `voce-io.ts` (player) |

Real time: one FSEvents stream with file-level events, batched by FSEvents to one callback a second. Each reload touches only the paths the events named (`GoalLoader`): the 1600+ session files are listed at launch and parsed only if changed since the on-disk index, then a rewrite costs one stat and one parse; only sessions in a shown goal's family reach the board, and an unchanged value publishes nothing. A full rescan happens only at launch, when FSEvents drops events, or when a new Claude app folder appears. A 30 s tick moves only the «since …» time; time-based state (yellow after 30 min still) is re-evaluated by a one-shot timer at the next instant it can change.

## Code layout
- `Sources/CodeIslandCore/GoalBoard.swift`: pure logic, goal → progress, traffic light, reason, session pulses. Tests in `Tests/CodeIslandCoreTests/GoalBoardTests.swift`.
- `Sources/CodeIslandCore/PullRequests.swift` + `Sources/CodeIsland/PullRequestFeed.swift` (issue #6, data only, no view yet): which PRs belong to a goal (`prs` of the family's session files, archived children included, plus PR links and `#N` in its proofs), the batched GraphQL query and the state mapping (merged, closed, green, pending, red, conflict). `PullRequestTracker.swift` holds the display rule: only OPEN PRs stay; a PR seen merged for the first time is one event, then dropped (merged PRs already shown are remembered in UserDefaults `goalnotch.seenMergedPRs`; the first pass after launch is a silent baseline); closed-unmerged vanish. Tests in `PullRequestsTests.swift`.
- `Sources/CodeIslandCore/GoalSources.swift`: parses the files above. `GoalLoader.swift` + `GoalFileCache.swift`: the incremental reader the watcher keeps (cache by mtime and size, work per changed path, only goal-family sessions reach the board, the on-disk index above).
- `Sources/CodeIsland/GoalStore.swift`: FSEvents watcher, publishes rows to the UI.
- The notch view (issue #3), one Liquid Glass design inside CodeIsland's black notch (`NotchPanelView.swift`, `PanelWindowController.swift`): `NotchSections.swift` (scale and plate) + `NotchAccountsPlate.swift`, `NotchGoalPlate.swift`, `NotchRequestsPlate.swift` (open: account usage, the goal chased now with the other goals, Roberto's requests), `GoalsNotchWings.swift` (closed: state, bar and proofs of the goal chased now), `NotchNotificationView.swift` + `NotchNotifier.swift` (notifications under the closed notch: goal changes from `CodeIslandCore/NotchEvents.swift`, requests from `GoalStore.takenToAnimate`), `NotchGlass.swift` (real `glassEffect` on macOS 26+, a stand-in before and in snapshots), `NotchTokens.swift` (colour, spacing and type tokens: the one file the approved Figma target changes), `GoalsNotchView.swift` (shared pieces).
- The voice light (issue #10): `CodeIslandCore/NotchVoice.swift` (contract, parser, level off the clock), `VoiceStore.swift` (file watcher, one-shot expiry), `VoiceEdgeLight.swift` (edge glow on the notch outline; a clock runs only while it is in the tree; Reduce Motion = steady). The notch view plugs it in.
- Everything else under `Sources/` is CodeIsland code kept for the shell; most of it is not reached at launch.
- `android-watch/`, `ios/`, `windows/`, `hardware/`, `apple-companion/`: CodeIsland companions, not built or used by goal-notch.

## Build
- Swift package (`Package.swift`, macOS 14+, Sparkle and Yams via SwiftPM).
- `./build.sh` on a Mac with Xcode: `swift build -c release --arch arm64`, then assembles `.build/release/CodeIsland.app` (executable name stays `CodeIsland`), ad-hoc signed unless `SIGN_ID` or a Developer ID is found.
- `CodeIsland.app/Contents/MacOS/CodeIsland --snapshot <dir> [--gallery]` renders the real notch from the live data to PNG and quits: closed, open, and with `--gallery` three frames of each notification today's data can produce (`GoalSnapshot.swift`). ImageRenderer cannot sample a backdrop, so the glass shows as its stand-in there; the real glass shows only in the running app.
- Linux sandboxes cannot build the app. They can run the goal logic tests: `bash scripts/test-goals-linux.sh`.

## Domains, ports, machines
None. No network service, no ports. Runs only on Roberto's Mac; developed in the `squaddv2` sandbox.

## Branches and path to production
Work branches → PR into `dev` → promotion PR `dev` → `main`. "Production" is the app built from `main` and run on the Mac. No migrations, functions or deploys. Auto-update (Sparkle) is off: there is no feed URL.

## Secrets
None.

## External services
At runtime one read-only HTTPS GET, no token: account usage from `https://claude.squaddbackend.com/dashboard/data` (the dashboard Roberto's Macchine app reads; same merge and order rules, `CodeIslandCore/AccountQuota.swift`, fetched by `AccountQuotaFeed.swift` at launch, every 60 s and when the notch opens; a failed fetch keeps the last good list and shows its age). Pull request state: one `gh api graphql` call (the `gh` already signed in on the Mac; no token asked or stored) for all PRs of the goals, run only when the notch opens or when the set of PRs changed, never on a timer; a failed call keeps the last good state and its time. CI: GitHub Actions (`architettura.yml`, an inline copy of the claude-config check on `ubuntu-latest`: this repo is public and cannot call a private reusable workflow or use the self-hosted runners; CodeIsland's own release/DMG workflows are manual and unused).
