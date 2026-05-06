<!-- Managed by agent: Codex. Scoped instructions for AgentRemote Electron work. -->

# AGENTS.md

## Overview

This directory contains the current AgentRemote Electron app: `main.js` for native process control and IPC, `index.html` for the renderer, and `assets/` for avatars.

## Setup

```bash
npm install
bash ../launch-remote.sh
```

`npm test` runs the current layout-policy unit tests plus the launcher pane-normalization helper test.

## Commands

- Launch: `bash ../launch-remote.sh`
- Stop: `bash ../launch-remote.sh stop`
- Duplicate check: `pgrep -fl "Electron\\.app/Contents/MacOS/Electron \\." | grep remote-app`

## Code style

- Use argv-style process execution in `main.js`; avoid shell string interpolation for tmux, iTerm, or file operations.
- Keep renderer changes aligned with `../DESIGN.md` tokens and component primitives.
- Keep the HUD lightweight: local spawn, attach, broadcast, status, voice, and nearby operator controls.
- Preserve local Whisper hold-to-talk and immediate send feedback when touching keybindings or broadcast flow.

## Security

- Do not expose arbitrary shell command entry from renderer state.
- Validate file paths and agent IDs in IPC handlers before touching the filesystem or tmux.
- Keep AgentRemote local-process oriented; do not add external service calls without an explicit plan.

## Checklist

- Read `../AGENTS.md`, `../docs/README.md`, and `../docs/exec-plans/active/agentremote-v1-pivot-plan.md`.
- Review dirty state before treating it as unrelated. Registry/avatar diffs can be app-generated from live AgentRemote usage or another TMUX-MASTA lane; classify them explicitly and merge them into the current understanding.
- Launch AgentRemote after UI or IPC changes.
- Verify the running Electron process points at `/Users/richardadair/agent-launch-scripts/remote-app`, not a stale `.codex/worktrees/.../agent-launch-scripts/remote-app` copy.
- Bump `package.json` and `package-lock.json` by SemVer for app changes, then verify the HUD build badge can identify version, branch, commit, dirty state, and checkout path.
- Verify tmux-facing changes against a real or intentionally mocked `chq` session before claiming success.
- At session end, run `bash ../scripts/session-end-cleanup.sh` to clear stale worktree Electron apps and stale Chromium caches, then relaunch the canonical HUD with `bash ../launch-remote.sh` unless Richard explicitly asked to leave AgentRemote stopped.

## Examples

- Good: `execFile('tmux', ['send-keys', '-t', coord, message, 'C-m'])`
- Bad: concatenating renderer-provided strings into a shell command.

## When stuck

- For UI/motion/aesthetic uncertainty, read `../.claude/agents/tmux-electron-master.md`.
- For product scope, read `../docs/product/agentremote.md`.
- For launch/runtime behavior, read `../docs/operations/launch-scripts.md`.
