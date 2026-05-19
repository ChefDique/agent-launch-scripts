# AgentRemote startup lines closeout — 2026-05-18 20:16

## Outcome
AgentRemote v1.4.8 is shipped on `main`, pushed, and relaunched from the canonical checkout. Image paste support remains covered by tests; Richard still owns the live UI paste check.

## Work shipped
- Ran `/chores` preflight and created the repo-local memory scaffold.
- Preserved the v1.4.7 image-paste repair for AgentRemote chat, pet chat, and embedded terminal paste paths.
- Added three editable `startup_lines` inputs beside `startup_slash` in the add/edit form and settings panel.
- Persisted `startup_lines` in `agents.json` with placeholder support for `{{color}}`, `{{rename_to}}`, `{{startup_slash}}`, `{{display_name}}`, `{{agent_id}}`, and `{{cwd}}`.
- Updated `launch-agent.sh` so explicit `startup_lines` drive Claude tmux startup injection; legacy `/color`, `/rename`, and `startup_slash` fallback only runs when `startup_lines` is absent.
- Fixed the review finding where generated fallback values could have been persisted during unrelated edits.
- Ran cheap static/code-review agents, then a final focused re-review after the fix.

## Artifacts
- Commit: `7935e5b` (`feat(agentremote): add dynamic startup lines`)
- Version: AgentRemote `1.4.8`
- Files: `remote-app/index.html`, `remote-app/main.js`, `launch-agent.sh`, `agents.json`, `docs/operations/launch-scripts.md`, `remote-app/test/renderer-static.test.js`, `test/launch-agent-runtime.test.sh`
- Verification: `npm run test:policy`, `npm test`, `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`, `jq . agents.json`, `git diff --check`, `bash test/launch-agent-runtime.test.sh`, `python3 -m pytest /Users/richardadair/ai_projects/swarmy/tests/test_agentremote_runtime.py -q`
- Relaunch: canonical AgentRemote running from `/Users/richardadair/ai_projects/agent-launch-scripts/remote-app`
- Learning: `.learnings/LEARNINGS.md` entry `LRN-20260518-001`

## Carryover
- Richard should live-test screenshot paste into AgentRemote main chat and embedded terminal.
- Richard can edit startup-line fields in AgentRemote and confirm the corresponding `startup_lines` array appears in `agents.json`.
- Separate existing carryover remains: AgentRemote Deploy permanent fix for clearing tmux `@hidden` and `@buried_indexes`.
