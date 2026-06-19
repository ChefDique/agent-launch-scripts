<!-- Managed by agent: Codex. Keep aligned with AGENTS.md; do not symlink. -->

# CLAUDE.md

This file intentionally matches the root `AGENTS.md` contract while adding Claude-specific operating details. Do not symlink it to `AGENTS.md`; keep both files aligned by editing them together.

## Repository Overview

`agent-launch-scripts` owns Richard's local agent launch infrastructure and the lightweight AgentRemote Electron HUD. This repo is the operator-station layer: per-agent launch wrappers, registry data, desktop UI, and message delivery into tmux panes. The canonical checkout path is `/Users/richardadair/ai_projects/agent-launch-scripts`; do not route active code through `/Users/richardadair/agent-launch-scripts`.

This lane's visible name is Neo. The stable registry id remains `neo`
because sidecar keys, tmux targeting, and historical docs depend on it. Neo is
the meta-agent/operator-station maintainer: sister-level to the agent fleet, not
one of the fleet panes.

## Startup Read Order

1. `.claude/memory/handoff.md` — current active thread and next verifiable step.
2. `memory/tasks/tasks.json` — canonical app-quality board; root `tasks.json` is only a compatibility pointer.
3. `context.md` — current model/runtime and ACRM operating contract.
4. `docs/README.md` — durable docs map.
5. `docs/product/agentremote.md` — product boundary and money-path focus.
6. `docs/operations/agentremote-operator-contract.md` — canonical "what Richard wants" contract for spawn/layout/runtime/window behavior.
7. `docs/operations/launch-scripts.md` — launcher, tmux, and deployment control notes.
8. `DESIGN.md` — AgentRemote visual system and migration target.
9. `docs/exec-plans/active/agentremote-v1-pivot-plan.md` — active pivot plan.
10. `remote-app/AGENTS.md` — required before UI or IPC edits.
11. `.claude/agents/tmux-electron-master.md` — specialist role/style reference for AgentRemote UI and tmux orchestration work.

## Key Components

| Path | Purpose |
|---|---|
| `remote-app/tmux-deploy.js` | Native single-window deploy (default spawn path). |
| `/Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py` | Optional fallback runtime (`AGENTREMOTE_SPAWN=swarmy`); still bridges attach/stop. |
| `chq-tmux.sh`, `rnd-tmux.sh`, `trading-tmux.sh` | Compatibility/manual tmux wrappers and project-specific sessions. |
| `launch-agent.sh`, agent wrapper scripts | Per-agent foreground launchers and auto-inject startup flow. |
| `agents.json` | Canonical local fleet registry consumed by scripts and AgentRemote. |
| `remote-app/` | Current Electron AgentRemote implementation. |
| `scripts/cron-poke.sh` | Scheduled `tmux send-keys` helper. |
| `docs/` | Durable product, operations, execution-plan, and reference docs. |

## Current Work

- Treat AgentRemote as the lightweight local operator HUD, not ACRM or Atlas. As of 2026-06-19 AgentRemote owns its **native** spawn path (`remote-app/tmux-deploy.js`, single window); swarmy is an optional `AGENTREMOTE_SPAWN=swarmy` fallback (attach/stop still bridge through it for now — see the operator contract).
- Core value is fast communication with agents: select targets, type or hold-to-talk, send instantly, and trust delivery feedback.
- `docs/operations/agentremote-operator-contract.md` is the canonical AgentRemote behavior contract. Do not claim an AgentRemote, launch, runtime, tmux/iTerm, or pet-chat task is complete if it violates that contract.
- Next product thread is the Codex pet runtime: read `~/.codex/pets/*/pet.json`, load the fixed Codex pet spritesheet, and map voice/send/status events to animation rows.
- Keep the remote model/runtime agnostic. It controls local processes and panes; it should not depend on one model vendor.
- Codex is the priority runtime while Claude tokens are constrained. Preserve Claude, Hermes, and OpenClaw support, but do not launch Claude from a Codex path unless the registry explicitly asks for `runtime: "claude"`.
- Any `runtime: "claude"` entry must also set `allow_claude_runtime: true`; tests should fail accidental Claude defaults.
- Use ACRM for task creation, review state, and agent lookup/creation decisions. `agents.json` remains the local execution registry and AgentRemote settings source until a live ACRM-backed add-agent path is implemented.

## Claude-Specific Role

- Maintain launch infrastructure: `launch-agent.sh`, the native `tmux-deploy.js` deploy path (the swarmy adapter is now an optional fallback), project tmux wrappers, `agents.json`, and restart-loop reliability.
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

To spawn the local team, use `python3 /Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py add xavier lucius gekko overlord-swarmy` or a subset. Use `python3 /Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py attach` to attach.

## Workflow Rules

- Root stack is Bash scripts plus an Electron subproject; there is no root package manager or CI.
- Preserve user/local work. Check `git status --short --branch` before editing.
- Treat dirty state as shared operational evidence, not a mystery. Review and classify every dirty file before and after work. If changes came from AgentRemote usage, another Neo/`neo` lane, or app-generated registry/avatar edits, say that explicitly and either integrate them or leave a concrete reason for deferring.
- For launcher edits, run targeted shell checks such as `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh` plus Swarmy's AgentRemote runtime tests.
- For Electron edits, use `bash launch-remote.sh`; do not start duplicate AgentRemote instances.
- For AgentRemote app edits, bump `remote-app/package.json` and `remote-app/package-lock.json` using SemVer before commit. The HUD must show `v<semver> <branch>@<sha>` so stale worktree apps are visually identifiable.
- Use argv-style process execution (`execFile` or equivalent) for tmux/iTerm/process-control code.
- Do not validate attach/deploy behavior by mutating Richard's live iTerm desktop unless he explicitly asks for that live mutation. Use static tests, mocked IPC, or isolated throwaway tmux sessions first.
- For AgentRemote UI, any scrollable modal, picker, popover, overlay, roster, log, or pet window must use the dark HUD scrollbar styling. Native white scrollbars are regressions.
- Before AgentRemote implementation work, check `.learnings/LEARNINGS.md` and promote any recurring correction into docs or runtime gates before coding around it again.
- Commit completed work units with clear messages, and push them to origin without asking as the operator/lead lane (per the global git-workflow lead-push default). Still escalate before destructive ops (`reset --hard`, force-push), committing anything secret, or governance/policy changes.

## Critical Patterns

- Agent display names, tmux pane titles, and registry `tmux_target` values are load-bearing for process detection and targeting. Claude uses `-n <Name>`; Codex/Hermes/OpenClaw rely on the tmux title set by the launcher.
- `launch-agent.sh` must build argv arrays per runtime; never assemble tmux, Codex, Claude, Hermes, or OpenClaw commands as shell strings.
- Restart loops live in the native deploy path (`tmux-deploy.js`: per-pane `remain-on-exit on` + a `pane-died` respawn hook) or compatibility tmux orchestrators, not inside per-agent launchers.
- AgentRemote deploys all selected agents as tiled panes in ONE tmux window (`@chq_layout=single`), surfaced through one marked iTerm control-mode viewer. The legacy multi-window layouts (teams/tabs/panes) are collapsed into this single-window model; launching N agents yields one window, never N.
- AgentRemote's pane style is one agent process in one tmux pane; all agents
  share ONE tmux window (tiled panes), surfaced by iTerm control mode. Do not use
  a normal `tmux attach` viewer or a merged shell as a workaround for paste,
  Shift+Enter, or Attach bugs — the single window uses real tmux panes.
- Status, kill, restart, attach, broadcast, and voice send paths must verify the actual target pane/result instead of showing optimistic success.
- Docs follow progressive disclosure: this file is the Claude supplement, `AGENTS.md` is the model-agnostic map, `docs/` is the system of record, and `.claude/memory/handoff.md` is the live continuation point.

## Session-End Housekeeping

- Before ending a session that launched, restarted, or tested AgentRemote, run `bash scripts/session-end-cleanup.sh` to clear stale Electron/worktree state, then relaunch the canonical HUD with `bash launch-remote.sh` unless Richard explicitly asks to leave AgentRemote stopped. Richard expects the shortcut key to work after agent closeout and should not have to guess whether the app is running.
- Use `--keep-agentremote` only when preserving an already-running live HUD is intentional and stale worktree instances have already been ruled out.
- The cleanup script is the model-agnostic closeout hook. It stops stale AgentRemote Electron processes from the canonical checkout and Codex worktrees, clears AgentRemote Chromium caches while preserving `Local Storage/` and `pet-state.json`, prints `git status`, lists worktrees, and reports any remaining AgentRemote processes.
- Do not leave app processes, worktree-launched HUDs, or unexplained dirty state behind at final response. If anything must remain running or dirty, say exactly what it is, why it remains, and how to clean it.
- If running under Codex Desktop/app-server instead of a tmux loop, do not kill `$PPID` during `/done`.

## Do Not

- Do not turn AgentRemote into the full ACRM/Atlas command center.
- Do not duplicate long operational manuals into `CLAUDE.md`; point to `docs/`, `DESIGN.md`, task evidence, or scoped `AGENTS.md` files.
- Do not remove deprecated launchers without checking `deprecated/README.md` and references.
- Do not change Telegram cleanup, tmux restart, or process-kill behavior without validating live process effects.
