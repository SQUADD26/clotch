# Architecture — goal-notch

## What the project is
A macOS notch app that shows only the goals of Roberto's master Claude sessions and whether each goal is getting closer (issue #1). It is a fork of CodeIsland (MIT, Swift): the notch shell, window and open/close motion come from CodeIsland; the content is replaced by the goal list. Display name `Goal Notch`, bundle id `com.squadd.goalnotch`.

## Backend and where it runs
No backend. The app runs on Roberto's Mac only and reads local files, read-only. It writes nothing into `~/.claude`, `~/.codex` or other agent configs (CodeIsland's hook installer, hook socket server, agent watchers and companion bridges are not started at launch).

## Data the app reads (all on the Mac, read-only)
| What | Path | Written by |
|---|---|---|
| Goals register, one file per master session | `~/.claude/obiettivi/<cli>.json` (`cli`, `obiettivo`, `stato` aperto/raggiunto/bloccato/passato, `prova`, `t`, `titolo`, `prove` = `[{testo, fatta, t}]` when present) | claude-config `global/hooks/obiettivo_registro.py` |
| Desktop app sessions | `~/Library/Application Support/[Cc]laude*/claude-code-sessions/**/local_*.json` (`sessionId`, `cliSessionId`, `spawnedFrom`, `title`, `isRunning`, `isArchived`, `lastActivityAt`) | Claude desktop app |
| Live subagents per session | `~/.claude/handoff/live/<cli>.json` (`agenti`, `aggiornato`) | claude-config `global/hooks/live_state.py` |

Real time: FSEvents on these folders; a 30 s tick only re-evaluates time-based state (yellow after 30 min still).

## Code layout
- `Sources/CodeIslandCore/GoalBoard.swift`: pure logic, goal → progress, traffic light, reason, session pulses. Tests in `Tests/CodeIslandCoreTests/GoalBoardTests.swift`.
- `Sources/CodeIslandCore/GoalSources.swift`: parses and reads the files above.
- `Sources/CodeIsland/GoalStore.swift`: FSEvents watcher, publishes rows to the UI.
- `Sources/CodeIsland/GoalsNotchView.swift` and `GoalsNotchWings.swift`: the goal rows and the collapsed wings inside CodeIsland's notch (`NotchPanelView.swift`, `PanelWindowController.swift`).
- Everything else under `Sources/` is CodeIsland code kept for the shell; most of it is not reached at launch.
- `android-watch/`, `ios/`, `windows/`, `hardware/`, `apple-companion/`: CodeIsland companions, not built or used by goal-notch.

## Build
- Swift package (`Package.swift`, macOS 14+, Sparkle and Yams via SwiftPM).
- `./build.sh` on a Mac with Xcode: `swift build -c release --arch arm64`, then assembles `.build/release/CodeIsland.app` (executable name stays `CodeIsland`), ad-hoc signed unless `SIGN_ID` or a Developer ID is found.
- `CodeIsland.app/Contents/MacOS/CodeIsland --snapshot <dir>` renders the real goal view (collapsed and expanded) from the live register to PNG and quits: the check where screen capture is not allowed (`GoalSnapshot.swift`).
- Linux sandboxes cannot build the app. They can run the goal logic tests: `bash scripts/test-goals-linux.sh`.

## Domains, ports, machines
None. No network service, no ports. Runs only on Roberto's Mac; developed in the `squaddv2` sandbox.

## Branches and path to production
Work branches → PR into `dev` → promotion PR `dev` → `main`. "Production" is the app built from `main` and run on the Mac. No migrations, functions or deploys. Auto-update (Sparkle) is off: there is no feed URL.

## Secrets
None.

## External services
None at runtime. CI: GitHub Actions (`architettura.yml`, an inline copy of the claude-config check on `ubuntu-latest`: this repo is public and cannot call a private reusable workflow or use the self-hosted runners; CodeIsland's own release/DMG workflows are manual and unused).
