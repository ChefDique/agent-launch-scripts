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
- Model dropdowns are local config, not live API lookups: update `config/harness-models.json`, `harness-models.js` tests, and both add/settings picker expectations together.
- No runtime or agent identity branching in UI/IPC paths: `index.html`,
  `pet-window.html`, and `main.js` IPC handlers must not contain agent-id,
  model-name, or runtime-name special cases except through validated registry
  policy fields and runtime normalization helpers. New pet-chat filtering must
  live in shared tested modules, not inline renderer regex lists.

## Security

- Do not expose arbitrary shell command entry from renderer state.
- Validate file paths and agent IDs in IPC handlers before touching the filesystem or tmux.
- Keep AgentRemote local-process oriented; do not add external service calls without an explicit plan.

## Checklist

- Read `../AGENTS.md`, `../docs/README.md`, `../docs/operations/agentremote-operator-contract.md`, and `../docs/exec-plans/active/agentremote-v1-pivot-plan.md`.
- The operator contract is the canonical "what Richard wants" source for spawn, attach, runtime selection, tmux/iTerm windows, pet chat, paste, and closeout behavior.
- For pet chat and pane-stream changes, run the stream-filter tests and verify
  the classifier remains agent/model agnostic. A fix that only handles the
  current visible agent is not complete.
- For Claude/Codex pet chat, prefer structured transcript extraction over
  tmux pane scraping. Transcript selection must prove the active cwd/session
  before rendering; if it cannot, return unavailable or use an explicit
  registry fallback rather than showing another session's newest output.
- Review dirty state before treating it as unrelated. Registry/avatar diffs can be app-generated from live AgentRemote usage or another Neo/`tmux-masta` lane; classify them explicitly and merge them into the current understanding.
- Launch AgentRemote after UI or IPC changes.
- Verify the running Electron process points at `/Users/richardadair/ai_projects/agent-launch-scripts/remote-app`, not the compatibility symlink or a stale `.codex/worktrees/.../agent-launch-scripts/remote-app` copy.
- Bump `package.json` and `package-lock.json` by SemVer for app changes, then verify the HUD build badge can identify version, branch, commit, dirty state, and checkout path.
- Verify tmux-facing changes against a real or intentionally mocked `chq` session before claiming success.
- Treat tmux as the durable backend and iTerm as a viewer. Do not validate attach/deploy behavior by creating or detaching live iTerm/tmux clients on Richard's desktop unless he explicitly asks for that live mutation. Prefer static tests, mocked IPC, or isolated throwaway tmux sessions.
- Preserve the AgentRemote pane contract: one agent process in one tmux pane,
  isolated into a solo tmux window, surfaced through iTerm control mode. Do not
  solve renderer/input bugs by opening a normal `tmux attach` view that merges
  multiple agents into one split-pane terminal.
- Any scrollable HUD surface must inherit the dark scrollbar treatment. Before finishing a modal, picker, popover, overlay, or pet window that can scroll, verify it cannot fall back to Chromium's white native scrollbar.
- Dock online state means the agent tmux pane/process exists. Do not make a live agent look offline just because no iTerm/tmux client is attached.
- At session end, run `bash ../scripts/session-end-cleanup.sh` to clear stale worktree Electron apps and stale Chromium caches, then relaunch the canonical HUD with `bash ../launch-remote.sh` unless Richard explicitly asked to leave AgentRemote stopped.

## Examples

- Good: `execFile('tmux', ['send-keys', '-t', coord, message, 'C-m'])`
- Bad: concatenating renderer-provided strings into a shell command.

## When stuck

- For UI/motion/aesthetic uncertainty, read `../.claude/agents/tmux-electron-master.md`.
- For product scope, read `../docs/product/agentremote.md`.
- For launch/runtime behavior, read `../docs/operations/launch-scripts.md`.
