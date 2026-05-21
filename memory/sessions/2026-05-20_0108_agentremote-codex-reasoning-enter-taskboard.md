# AgentRemote Codex Reasoning, Enter Guard, and Taskboard Consolidation — 2026-05-20 01:08

## Outcome
Codex reasoning is now registered/defaulted to `xhigh` in the AgentRemote catalog, registry, launcher fallback, and runtime policy. The taskboard split was consolidated into `memory/tasks/tasks.json`, with root `tasks.json` left as a compatibility pointer.

## Work
- Restored the Codex launcher path that had drifted: `--no-alt-screen` and the configured startup command are passed again.
- Changed Codex defaults to `xhigh` and preserved explicit `xhigh` instead of normalizing it away.
- Set current Codex registry entries to `reasoning_effort: "xhigh"`.
- Made default Claude startup injection exclude `dangerous_permission_enter`; explicit policy can still opt in.
- Added a renderer guard so the embedded terminal drops standalone Enter when its terminal pane is not focused.
- Merged root and memory taskboards into `memory/tasks/tasks.json`; root `tasks.json` now points there.

## Artifacts
- `agents.json`
- `launch-agent.sh`
- `remote-app/config/harness-models.json`
- `remote-app/harness-models.js`
- `remote-app/main.js`
- `remote-app/index.html`
- `memory/tasks/tasks.json`
- `tasks.json`
- `AGENTS.md`
- `CLAUDE.md`

## Verification
- `jq . memory/tasks/tasks.json tasks.json agents.json remote-app/config/harness-models.json memory/session-status.json`
- `node --test remote-app/test/harness-models.test.js remote-app/test/renderer-static.test.js remote-app/test/terminal-input.test.js remote-app/test/harness-options.test.js`
- `bash -n launch-agent.sh chq-tmux.sh launch-remote.sh scripts/session-end-cleanup.sh`
- `bash test/launch-agent-runtime.test.sh`
- `bash test/chq-ittab-window-layout.test.sh`
- `bash test/chq-codex-runtime-smoke.test.sh`
- `git diff --check`

## Followups
- Relaunch or refresh the running AgentRemote HUD before expecting the UI to show the new reasoning catalog/defaults.
- Live-check the Codex settings picker and unfocused-terminal Enter behavior before marking ALS-LOCAL-005 or ALS-LOCAL-006 done.
