# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Dynamic AgentRemote startup injection controls after v1.4.7 image-paste repair.

**State at last pause (2026-05-18T19:34:14-0700):**
- `/chores` preflight found missing repo-local `memory/`; scaffolded `memory/handoff.md`, `memory/agent-notes/tmux-masta.md`, sessions, coord, audits, decisions, workflows, and local task fallback.
- Prior shipped state: `main` is clean/pushed at `2f4a2c2`, AgentRemote v1.4.7 is running from the canonical checkout, and image paste is already fixed in AgentRemote embedded terminal paths pending Richard live verification.
- New requested work is tracked in `memory/tasks/tasks.json`: add editable post-startup injection fields beside `startup_slash`, use them to replace hardcoded `/color`-style startup injections, test, and send lint/review agents before merge.

**Next verifiable step:** Dispatch cheap worker agents to inspect the add/edit form, registry schema, and `launch-agent.sh` startup injection path, then implement the dynamic startup-injection fields.

**If that step fails:** Stop before live tmux mutation; compare UI save fields, `agents.json` persistence, and launcher runtime args in tests to find which layer dropped the startup injection list.

**Pending uncommitted diff:** `memory/` scaffold and task cursor only.

## Open priorities (<=5)

- [ACTIVE NEXT] **Dynamic startup injection controls** — Add three editable post-startup text fields beside `startup_slash`, persist them in `agents.json`, and have launcher startup injection consume those dynamic lines instead of hardcoded `/color` behavior.
- [WAIT] **Live image-paste verification** — Richard needs to paste a screenshot into AgentRemote main chat and embedded terminal after v1.4.7 relaunch; code and tests are complete.
- [WAIT] **AgentRemote Deploy permanent fix** — clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy; not part of this startup-injection task.

## Cross-session comms

_None._
