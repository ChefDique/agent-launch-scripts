<!-- Managed by agent: Codex. Keep aligned with CLAUDE.md; do not symlink. -->

# AGENTS.md

## Repository Overview

`agent-launch-scripts` owns Richard's local agent launch infrastructure and the lightweight AgentRemote Electron HUD. This repo is the operator-station layer: spawn and supervise local agent sessions, route messages to tmux panes, and keep the always-on desktop remote useful and polished.

`AGENTS.md` is the model-agnostic root map. `CLAUDE.md` must match this contract and may add only Claude-specific peer/tooling details. Do not symlink the files; prior symlink experiments confused other harnesses.

Precedence: closest `AGENTS.md` wins for scoped instructions.

## Startup Read Order

1. `.claude/memory/handoff.md` — current active thread and next verifiable step.
2. `docs/README.md` — durable docs map.
3. `docs/product/agentremote.md` — product boundary and money-path focus.
4. `docs/operations/launch-scripts.md` — launcher, tmux, and deployment control notes.
5. `DESIGN.md` — AgentRemote visual system and migration target.
6. `docs/exec-plans/active/agentremote-v1-pivot-plan.md` — active pivot plan.
7. `remote-app/AGENTS.md` — required before UI or IPC edits.

## Index of scoped AGENTS.md

- `./remote-app/AGENTS.md` — Electron renderer, IPC, and AgentRemote UI/runtime rules.

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

## Workflow Rules

- Root stack is Bash scripts plus an Electron subproject; there is no root package manager or CI.
- Preserve user/local work. Check `git status --short --branch` before editing.
- For launcher edits, run targeted shell checks such as `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`.
- For Electron edits, use `bash launch-remote.sh`; do not start duplicate AgentRemote instances.
- Use argv-style process execution (`execFile` or equivalent) for tmux/iTerm/process-control code.
- Commit completed work units with clear messages. Push only when Richard asks.

## Critical Patterns

- `claude -n <Name>` names are load-bearing for pane titles, process detection, and targeting.
- Restart loops live in tmux orchestrators, not inside per-agent launchers.
- Tmux layout choices can be locked into a live session via `@chq_layout`; stop/redeploy when changing layout semantics.
- Status, kill, restart, attach, broadcast, and voice send paths must verify the actual target pane/result instead of showing optimistic success.
- Docs follow progressive disclosure: this file is the map, `docs/` is the system of record, and `.claude/memory/handoff.md` is the live continuation point.

## Do Not

- Do not turn AgentRemote into the full ACRM/Atlas command center.
- Do not duplicate long operational manuals into `AGENTS.md`; point to `docs/`, `DESIGN.md`, task evidence, or scoped `AGENTS.md` files.
- Do not remove deprecated launchers without checking `deprecated/README.md` and references.
- Do not change Telegram cleanup, tmux restart, or process-kill behavior without validating live process effects.
