# AGENTS.md

## Repository Overview

`agent-launch-scripts` owns Richard's local agent launch infrastructure and the lightweight AgentRemote Electron HUD. It is the operator-station repo: spawn/supervise local agent sessions, route messages to tmux panes, and keep the desktop control surface working.

## Key Components

| Path | Purpose |
|---|---|
| `chq-tmux.sh`, `rnd-tmux.sh`, `trading-tmux.sh` | Tmux session orchestration and layout behavior. |
| `launch-agent.sh`, `xavier.sh`, `lucius.sh`, `gekko.sh`, `swarmy.sh` | Per-agent foreground launchers and auto-inject startup flow. |
| `agents.json` | Local fleet registry consumed by scripts and AgentRemote. |
| `remote-app/` | Current Electron AgentRemote implementation. Read `remote-app/AGENTS.md` before UI or IPC edits. |
| `docs/README.md` | Durable docs map and read order. |
| `DESIGN.md` | Current AgentRemote design-system and migration target. |

## Current Work

- Read `docs/exec-plans/active/agentremote-v1-pivot-plan.md` before changing AgentRemote behavior.
- Treat AgentRemote as the lightweight local operator HUD, not ACRM, Atlas, or the Swarmy worker runtime.
- Keep model-specific guidance out of product/runtime docs unless the behavior truly depends on that harness.

## Workflow Rules

- Root stack is Bash scripts plus an Electron subproject; there is no root package manager or CI.
- For launcher edits, run targeted shell checks such as `bash -n chq-tmux.sh launch-agent.sh`.
- For Electron edits, use `cd remote-app && npm install` if deps are missing, then launch via `bash ../launch-remote.sh`.
- Do not start duplicate AgentRemote instances; `launch-remote.sh` is intended to kill the prior instance first.
- Preserve user/local work. Check `git status --short --branch` before editing.

## Critical Patterns

- `claude -n <Name>` names are load-bearing for pane titles, process detection, and targeting.
- Restart loops live in tmux orchestrators, not inside per-agent launchers.
- Broadcast and process-control code must use argv-style execution (`execFile` or equivalent), not shell-concatenated strings.
- Tmux layout choices can be locked into a live session via `@chq_layout`; stop/redeploy when changing layout semantics.
- Docs should follow progressive disclosure: this file is the map, `docs/` is the system of record.

## Do Not

- Do not turn AgentRemote into the full ACRM/Atlas command center.
- Do not duplicate long operational manuals into `AGENTS.md`; point to `docs/`, `DESIGN.md`, or task evidence.
- Do not remove deprecated launchers without checking `deprecated/README.md` and existing references.
- Do not change Telegram cleanup or tmux restart behavior without validating live process effects.
