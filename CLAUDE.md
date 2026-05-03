# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operating role

The Claude that runs in this directory is Richard's **meta-agent / operator-station maintainer** — sister-level to the chq fleet, not in their tmux session. Distinct from the four specialists (Xavier, Lucius, Gekko, Swarmy), this Claude owns the launch infrastructure itself and the local control surface (the Electron HUD called **AgentRemote** — see `DESIGN.md`).

Job:
- Keep the launch scripts (`launch-agent.sh`, `chq-tmux.sh`, `agents.json`) clean and the auto-restart loop reliable.
- Maintain the local Electron HUD at `remote-app/` (AgentRemote), future migration target `~/ai_projects/agent-remote/`.
- Dispatch to the **`tmux-electron-master`** subagent (registered at `.claude/agents/tmux-electron-master.md`) for any UI / aesthetic / Electron-internals work — it's the specialist; this Claude orchestrates.
- Drive cross-fleet operations from this chair (spawn the team, broadcast, restart panes, attach via iTerm) using the scripts that live here.
- Talk to the four specialists via `claude-peers` MCP (they're peers, not subagents). Use `scope=machine` when calling `list_peers` — `directory`/`repo` scopes return zero from this cwd because no peer shares it.

Default disposition: lean, executive, decision-disciplined per `~/.claude/rules/decision-discipline.md`. State and act, don't menu Richard. Commit completed work units without asking per `~/.claude/rules/git-workflow.md`.

## Fleet (peers, not subagents)

| Persona | Project | CWD | Persona purpose |
|---|---|---|---|
| **Xavier** | CHQ | `~/ai_projects/CorporateHQ` | Platform orchestrator — drives ACRM work, dispatches builds, owns the Armory UI |
| **Lucius** | R&D | `~/ai_projects/research-and-development` | Applied-sciences head — evaluations, research, capability validation |
| **Gekko** | Trading | `~/ai_projects/trading` | Trading lead — strategy, capital, the governance gates in `decision-discipline.md` |
| **Swarmy** (overlordswarmy) | Swarmy | `~/ai_projects/swarmy` | Multi-agent overlord — orchestrates teams, runtime contracts, capability gates |

**Reaching them:** `mcp__claude-peers__list_peers --scope=machine` to discover peer IDs (their CWDs are the disambiguator). `mcp__claude-peers__send_message --to_id=<id>` to dispatch a self-contained brief — peer messages don't carry conversation context, so include everything they need to act.

**Spawning them from here:** `bash chq-tmux.sh start xavier lucius gekko swarmy` (or any subset). `bash chq-tmux.sh add <id>` to add a pane to a running session. `bash launch-agent.sh <id>` to launch one in the foreground.

## Active workstreams (read these on session start)

- **`DESIGN.md`** (this repo, top-level) — design spec for AgentRemote. Tokens, components, migration plan to `~/ai_projects/agent-remote/`.
- **`~/ai_projects/CorporateHQ/ACRM/docs/proposals/iso-roomgrid-spike.md`** — proposal for a Phaser-rendered isometric variant of ACRM's RoomGrid. **Validated via `/validate-proposal` 2026-05-02** with 4 critics (PRs #403/404/405 merged, operational memo at local commit `e58b83b` — push blocked by ACRM's pre-push build hook). All four returned PASS-WITH-REVISIONS. Convergent themes: pivot to Pixi (already a dep at `pixi.js@8.18.1`); drop precision unmeasured; success criteria measure wrong things; flag mechanism contradicts existing `NEXT_PUBLIC_AGENT_ISLANDS_ENABLED` precedent. Xavier is driving v1.1 spec through ACRM. **Don't auto-start the spike.**
- **Inline user-stories artifact** — `~/ai_projects/CorporateHQ/ACRM/docs/research/2026-05-02-gekko-iso-roomgrid-spike-user-stories.md`. Operator-side findings I wrote concurrent with the panel.

## Outstanding for AgentRemote (the local Electron HUD)

Backlog after the recent overhaul:
- Tmux command palette popover (~14 curated commands: pane break/join/kill/split/swap/zoom/resize, layout presets, window/session ops). Use the same hardened `execFile`-with-argv pattern.
- Layout-preset selector for Deploy flow (un-greenlit pending iso direction).
- Bidirectional chat (read agent replies into the panel via tmux pipe-pane / xterm.js) — explicitly deferred per Phase 3 in DESIGN.md.

Already shipped recent: registry-driven launcher, Edit-mode-gated destructive ops, radial fan menu (cwd / kill / restart / attach), name labels, send-Enter fix, Ctrl+Shift+Space global shortcut, drag-region fix.

## Permissions / system state to remember

- **Ctrl+Shift+Space requires Input Monitoring permission** for the Electron binary at `remote-app/node_modules/electron/dist/Electron.app`. macOS 26 Tahoe routes synthesized osascript events differently from real keypresses; the shortcut silently no-ops without the grant. Fallbacks ship: `bash launch-remote.sh toggle`, `kill -SIGUSR1 <pid>`, `touch remote-app/.toggle`.
- **`remoteControlAtStartup: true`** in `~/.claude/settings.json` — Remote Control bridge auto-starts every session. `isolatePeerMachines` and `autoUploadSessions` deliberately left off.

## What this repo is

System-level launchers and a floating Electron controller for AdairLabs Claude Code agent sessions. Consolidated 2026-04-18 from scattered project repos. Agents live elsewhere (`~/ai_projects/CorporateHQ`, `~/ai_projects/research-and-development`, `~/ai_projects/trading`, `~/ai_projects/swarmy`, `~/ai_projects/agent-factory`); this repo only owns how they are spawned, supervised, and controlled.

There is no build, no test suite, and no package manager root — the only `package.json` is inside `remote-app/` for Electron deps.

## Common operations

```bash
# CHQ tmux — the central orchestrator. Even the macOS/Electron remotes route through this.
bash chq-tmux.sh start [agent...]   # interactive prompt if no args; "all" = full bench
bash chq-tmux.sh start xavier mugatu derek   # spawn a subset, left-to-right
bash chq-tmux.sh stop | status | attach
bash chq-tmux.sh restart <name>     # SIGINT the pane; restart loop relaunches in 3s

# Single-agent foreground launchers (also called from tmux pane_loop)
bash xavier.sh        # Platform Orchestrator   → ~/ai_projects/CorporateHQ
bash lucius.sh        # R&D Lead                → ~/ai_projects/research-and-development
bash gekko.sh         # Trading Lead            → ~/ai_projects/trading
bash swarmy.sh        # Multi-agent overlord    → ~/ai_projects/swarmy
bash tmux-electron-master.sh  # Gemini, scoped to this repo

# Project-scoped tmux orchestrators (subset of chq-tmux.sh for one team)
bash rnd-tmux.sh start            # Lucius only
bash trading-tmux.sh start        # Gekko only

# Idempotent "wake the agent if not already running" entrypoints
bash spawn-lucius.sh              # used by Xavier / Claude Desktop dispatch
bash spawn-swarmy.sh

# Agent Remote — floating Electron controller with deploy + broadcast modes
bash launch-remote.sh             # start (kills any prior instance first)
bash launch-remote.sh stop

# Older alternate UIs (all funnel into chq-tmux.sh start)
python3 agent-remote.py           # Tkinter floating remote
swift remote-control.swift        # native Cocoa NSPanel
bash remote-toolkit.sh            # osascript "choose from list"
bash term-remote.sh               # terminal menu
```

## Architecture

### Three layers

1. **Per-agent launchers** (`xavier.sh`, `lucius.sh`, `gekko.sh`, `swarmy.sh`, `tmux-electron-master.sh`) — `cd` to the project root, run pre-launch telegram cleanup, then `exec claude ... -n <Name>`. The `-n <Name>` flag is load-bearing: it's the source of truth used by spawners, tmux pane titles, and the Electron broadcast targeter. Don't change it without updating consumers.

2. **Tmux orchestrators** (`chq-tmux.sh`, `rnd-tmux.sh`, `trading-tmux.sh`) — create a detached session, drop each per-agent script into its own pane wrapped in `while true; bash <script>; sleep $RESTART_DELAY; done`. The restart loop lives **only here**, never inside the per-agent scripts (nesting it would compound `RESTART_DELAY`). `chq-tmux.sh` is the canonical multi-agent entrypoint; the others are project-scoped subsets that follow the same template.

3. **Idempotent spawners** (`spawn-lucius.sh`, `spawn-swarmy.sh`) — detect a live agent via `ps -eo command= | grep 'claude .*-n <Name>'` (NOT `pgrep -f`, which truncates args past ~200 bytes on macOS). If running, exit 0 with status; otherwise dispatch the appropriate tmux launcher. These are what Xavier/Claude Desktop call to "wake" an agent without risking a `telegram-cleanup --pre-launch` killing the live one.

### Standard claude invocation

Every launcher exec's claude with this exact flag set:

```
--channels plugin:telegram@claude-plugins-official       # Telegram routing
--dangerously-skip-permissions                           # hooks/tools don't prompt in tmux
--dangerously-load-development-channels server:claude-peers   # peer messaging
--exclude-dynamic-system-prompt-sections                 # keep context lean
--model 'claude-opus-4-7[1m]' --effort max
-n <Name>
```

`chq-tmux.sh` defines these once in `CLAUDE_FLAGS`; the per-agent scripts hardcode them. Keep the two in sync if you change a flag.

### The auto-inject sequence (in every per-agent script)

When running inside a tmux pane (`$TMUX_PANE` set), each script schedules three background `tmux send-keys` jobs to fire after claude boots:

- `sleep 4` — Enter, dismisses the dev-channels warning
- `sleep 10` — `/color <color>` then `/rename <NAME>`
- `sleep 12` — `$STARTUP_SLASH` (default `/gogo`, configurable for Gekko)

**Critical: stale-pid cleanup.** Each script writes background PIDs to `/tmp/<agent>-bg-${TMUX_PANE//%/_}.pids`, and on relaunch SIGKILLs them **before** their sleep children — order matters. Killing `sleep` first unblocks bash, which then runs `tmux send-keys` into the new claude session mid-boot (the "2/3 failed Enters before the real one" race). Use `kill -9` on the subshell PID, then `pkill -9 -P <pid>` on its children. SIGTERM is wrong here — bash can trap it.

### Agent Remote (Electron)

`remote-app/` is a frameless 540×180 always-on-top BrowserWindow that uses `node-integration` IPC (no preload bridge). Two modes:

- **Deploy mode** (default) — selected agents → `ipcRenderer.send('spawn-agents', ids)` → `bash chq-tmux.sh start <ids>` → `osascript` opens an iTerm tab and runs `chq-tmux.sh attach`. Note the `gekko → trading` rewrite in `index.html` (`executeMainAction`) — the button id is `gekko` but `chq-tmux.sh` knows it as the `trading` department in some routes; the legacy mapping is preserved for backwards compat with `remote-toolkit.sh` / `term-remote.sh`.
- **Broadcast mode** — typed message → `tmux list-panes -a -F '...{pane_title}' | grep -i '<target>$'` to resolve coordinates, then `tmux send-keys -t <coord> "<msg>" C-m` per selected agent. Targeting depends on pane titles set via `select-pane -T` in the orchestrators (which mirror the agent's `-n <Name>` lowercased). If a broadcast doesn't land, the regex in `main.js:57` is the place to look.

### Telegram voice follow-up hook

`telegram-voice-followup.sh` is a `PostToolUse` hook (matcher `mcp__plugin_telegram_telegram__reply`). After any agent's Telegram text reply, it shells out to local Kokoro TTS at `~/ai_projects/tools/kokoro/.venv311/bin/python3.11` and posts a voice bubble via `sendVoice`. Per-agent voice via `KOKORO_VOICE` env var. Failures log to `/tmp/telegram-voice-followup-errors.log` and exit 0 — never block the parent reply.

## Conventions worth knowing

- **Project ownership.** This repo's `.claude/agents/tmux-electron-master.md` registers the local Gemini agent. Anything UI-precision (Electron glassmorphism, SVG fidelity) or orchestration-integrity (broadcast targeting, pane regex, restart-loop semantics) is its turf.
- **`xavier.sh` is a harness slot, not a department.** It's listed first in `chq-tmux.sh` `DEPARTMENTS` so it lands as the leftmost pane on `start all`. Engineering, Marketing, R&D, Operations, and CEO_Office moved to `~/ai_projects/agent-factory/` — their scripts now live there, not here.
- **Pivot knobs.** `xavier.sh` and `gekko.sh` honor `PROJECT_ROOT` and `STARTUP_SLASH` env overrides so a shell alias can repoint them at a different project without forking the script.
- **Process detection.** Always `ps -eo command= | grep -E 'claude .*-n <Name>'`, never `pgrep -f` (truncation), and capture via `$(...)` to avoid SIGPIPE under `set -o pipefail`.
- **`session-cleanup.sh.disabled-2026-04-23`** is intentionally disabled — leave it alone unless you know why it was disabled.
