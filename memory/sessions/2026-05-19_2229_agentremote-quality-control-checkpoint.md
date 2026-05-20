# AgentRemote Quality Control Checkpoint — 2026-05-19 22:29

## Outcome

AgentRemote now has a root `tasks.json`, PRD, feature index, and quality-gate matrix so future sessions have a concrete product/control-plane map before changing code.

## Work

- Created root `tasks.json` as the app-quality task board.
- Added `docs/product/agentremote-prd.md`, `docs/product/agentremote-feature-index.md`, and `docs/operations/agentremote-quality-gates.md`.
- Updated startup read order so `tasks.json`, PRD, feature index, and quality gates are explicit startup context.
- Fixed and tested the current regressions around model/thinking selection, Claude-only startup injection, image paste submit, Option-key terminal word editing, literal tmux sends, and iTerm viewer targeting.
- Installed and verified the global Neo `PreToolUse` guard in `~/.codex/hooks.json`.

## Artifacts

- `tasks.json`
- `docs/product/agentremote-prd.md`
- `docs/product/agentremote-feature-index.md`
- `docs/operations/agentremote-quality-gates.md`
- `remote-app/package.json` now reports AgentRemote `v1.4.12`

## Followups

- Run the full safe suite after handoff edits and commit the checkpoint if it remains green.
- Do not claim live AgentRemote PASS until Richard approves live AgentRemote/iTerm/tmux verification.
- Swarmy still owns the unsupported `gpt-5.1` worker-launch fix.
