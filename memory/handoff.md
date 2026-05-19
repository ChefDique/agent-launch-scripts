# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote v1.4.8 dynamic startup lines after v1.4.7 image-paste repair.

**State at last pause (2026-05-18T19:55:18-0700):**
- `/chores` preflight is complete and repo-local `memory/` now exists.
- v1.4.7 image paste remains intact: AgentRemote chat, floating pet chat, and embedded terminal paste tests all pass. Richard still owns live screenshot-paste verification in the running UI.
- v1.4.8 adds three editable `startup_lines` fields beside `startup_slash` in the add/edit form and settings panel. Lines persist to `agents.json`, support `{{color}}`, `{{rename_to}}`, `{{startup_slash}}`, `{{display_name}}`, `{{agent_id}}`, and `{{cwd}}`, and are sent literally for Claude tmux startup.
- Launcher fallback is preserved only when `startup_lines` is absent. Explicit `startup_lines: []` disables legacy `/color`/`/rename`/startup fallback. Editing an old Claude entry without changing the new line inputs does not silently rewrite it.
- Cheap agents completed implementation/review lanes: one lint/static pass clean, one code review found the legacy-edit drift, and a final re-review after the fix was clean.
- Verification passed: `npm run test:policy`, `npm test`, `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`, `jq . agents.json`, `git diff --check`, `bash test/launch-agent-runtime.test.sh`, and Swarmy `test_agentremote_runtime.py`.

**Next verifiable step:** After commit/merge/push/relaunch, Richard should live-test one screenshot paste in AgentRemote chat and one in the embedded terminal, then edit an agent's startup line fields and confirm the saved lines appear in `agents.json`.

**If that step fails:** For paste failures, inspect the Electron clipboard image path and `send-chat-message` payload first. For startup-line failures, compare renderer `startupLines`, main-process `startup_lines`, and `launch-agent.sh` `STARTUP_LINES`.

**Pending uncommitted diff:** v1.4.8 dynamic startup-line implementation plus this handoff update, ready for commit/merge.

## Open priorities (<=5)

- [REVIEW] **Dynamic startup injection controls** — Implementation/test/review complete in v1.4.8; awaiting live UI verification after canonical relaunch.
- [WAIT] **Live image-paste verification** — Richard needs to paste a screenshot into AgentRemote main chat and embedded terminal after relaunch; code and tests are complete.
- [WAIT] **AgentRemote Deploy permanent fix** — clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy; not part of this startup-injection task.

## Cross-session comms

_None._
