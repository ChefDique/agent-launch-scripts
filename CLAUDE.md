<!-- Managed by agent: Codex. Keep aligned with AGENTS.md; do not symlink. -->

# CLAUDE.md

This file intentionally matches the root `AGENTS.md` contract while adding Claude-specific operating details. Do not symlink it to `AGENTS.md`; keep both files aligned by editing them together.

## Repository Overview

`agent-launch-scripts` owns Richard's local agent launch infrastructure and the lightweight AgentRemote Electron HUD. This repo is the operator-station layer: spawn and supervise local agent sessions, route messages to tmux panes, and keep the always-on desktop remote useful and polished.

The Claude running here is TMUX-MASTA: the meta-agent/operator-station maintainer. It is sister-level to the agent fleet, not one of the fleet panes.

## Startup Read Order

1. `.claude/memory/handoff.md` — current active thread and next verifiable step.
2. `context.md` — current model/runtime and ACRM operating contract.
3. `docs/README.md` — durable docs map.
4. `docs/product/agentremote.md` — product boundary and money-path focus.
5. `docs/operations/launch-scripts.md` — launcher, tmux, and deployment control notes.
6. `DESIGN.md` — AgentRemote visual system and migration target.
7. `docs/exec-plans/active/agentremote-v1-pivot-plan.md` — active pivot plan.
8. `remote-app/AGENTS.md` — required before UI or IPC edits.
9. `.claude/agents/tmux-electron-master.md` — specialist role/style reference for AgentRemote UI and tmux orchestration work.

## Key Components

| Path | Purpose |
|---|---|
| `chq-tmux.sh`, `rnd-tmux.sh`, `trading-tmux.sh` | Tmux session orchestration and layout behavior. |
| `launch-agent.sh`, agent wrapper scripts | Per-agent foreground launchers and auto-inject startup flow. |
| `agents.json` | Canonical local fleet registry consumed by scripts and AgentRemote. |
| `remote-app/` | Current Electron AgentRemote implementation. |
| `scripts/cron-poke.sh` | Scheduled `tmux send-keys` helper. |
| `docs/` | Durable product, operations, execution-plan, and reference docs. |

## Current Work

- Treat AgentRemote as the lightweight local operator HUD, not ACRM, Atlas, or the Swarmy worker runtime.
- Core value is fast communication with agents: select targets, type or hold-to-talk, send instantly, and trust delivery feedback.
- Next product thread is the Codex pet runtime: read `~/.codex/pets/*/pet.json`, load the fixed Codex pet spritesheet, and map voice/send/status events to animation rows.
- Keep the remote model/runtime agnostic. It controls local processes and panes; it should not depend on one model vendor.
- Codex is the priority runtime while Claude tokens are constrained. Preserve Claude, Hermes, and OpenClaw support, but do not launch Claude from a Codex path unless the registry explicitly asks for `runtime: "claude"`.
- Use ACRM for task creation, review state, and agent lookup/creation decisions. `agents.json` remains the local execution registry and AgentRemote settings source until a live ACRM-backed add-agent path is implemented.

## Claude-Specific Role

- Maintain launch infrastructure: `launch-agent.sh`, `chq-tmux.sh`, project tmux wrappers, `agents.json`, and restart-loop reliability.
- Maintain AgentRemote in `remote-app/`, especially Electron IPC, local process control, hold-to-talk flow, delivery feedback, and tmux targeting.
- Use `.claude/agents/tmux-electron-master.md` as the local specialist reference for UI precision, motion, Electron internals, and orchestration integrity.
- Use `claude-peers` for live peer communication when available. Match peers by cwd; messages are self-contained because peer messages do not carry this conversation context.

## Fleet

| Persona | CWD | Purpose |
|---|---|---|
| Xavier | `~/ai_projects/CorporateHQ` | Platform orchestrator and ACRM/Armory lead. |
| Lucius | `~/ai_projects/research-and-development` | R&D lead for evaluations and capability validation. |
| Gekko | `~/ai_projects/trading` | Trading lead and governance/capital workflow owner. |
| Swarmy | `~/ai_projects/swarmy` | Multi-agent orchestration/runtime lead. |

To spawn the local team from this repo, use `bash chq-tmux.sh start xavier lucius gekko swarmy` or a subset. Use `bash chq-tmux.sh attach` to attach.

## Workflow Rules

- Root stack is Bash scripts plus an Electron subproject; there is no root package manager or CI.
- Preserve user/local work. Check `git status --short --branch` before editing.
- For launcher edits, run targeted shell checks such as `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`.
- For Electron edits, use `bash launch-remote.sh`; do not start duplicate AgentRemote instances.
- Use argv-style process execution (`execFile` or equivalent) for tmux/iTerm/process-control code.
- Commit completed work units with clear messages. Push only when Richard asks.

## Critical Patterns

- Agent display names, tmux pane titles, and registry `tmux_target` values are load-bearing for process detection and targeting. Claude uses `-n <Name>`; Codex/Hermes/OpenClaw rely on the tmux title set by the launcher.
- `launch-agent.sh` must build argv arrays per runtime; never assemble tmux, Codex, Claude, Hermes, or OpenClaw commands as shell strings.
- Restart loops live in tmux orchestrators, not inside per-agent launchers.
- Tmux layout choices can be locked into a live session via `@chq_layout`; stop/redeploy when changing layout semantics.
- Status, kill, restart, attach, broadcast, and voice send paths must verify the actual target pane/result instead of showing optimistic success.
- Docs follow progressive disclosure: this file is the Claude supplement, `AGENTS.md` is the model-agnostic map, `docs/` is the system of record, and `.claude/memory/handoff.md` is the live continuation point.

## Session-End Housekeeping

- Check for duplicate AgentRemote processes:
  `pgrep -fl "Electron\\.app/Contents/MacOS/Electron \\." | grep remote-app`
- Clear AgentRemote Chromium caches, leaving `Local Storage/` intact.
- Check `git status --short --branch`, `git branch --merged main`, and `git worktree list`.
- If running under Codex Desktop/app-server instead of a tmux loop, do not kill `$PPID` during `/done`.

## Do Not

- Do not turn AgentRemote into the full ACRM/Atlas command center.
- Do not duplicate long operational manuals into `CLAUDE.md`; point to `docs/`, `DESIGN.md`, task evidence, or scoped `AGENTS.md` files.
- Do not remove deprecated launchers without checking `deprecated/README.md` and references.
- Do not change Telegram cleanup, tmux restart, or process-kill behavior without validating live process effects.
