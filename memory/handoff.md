# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** None — AgentRemote v1.4.8 startup-lines work is closed and shipped.

**State at last pause (2026-05-18T20:16:48-0700):**
- `main` is pushed at `7935e5b` with AgentRemote v1.4.8 and the canonical HUD relaunched from `/Users/richardadair/ai_projects/agent-launch-scripts/remote-app`.
- Code/tests cover image paste in AgentRemote chat, pet chat, and embedded terminal paths. Richard still needs to perform live screenshot-paste verification in the UI.
- Three editable `startup_lines` fields are available beside `startup_slash`; configured lines support the documented placeholders and are sent literally for Claude tmux startup.
- The generated legacy fallback display is guarded: old Claude entries are not rewritten unless the startup-line inputs actually change; explicit `startup_lines: []` disables fallback.
- `/done` closeout wrote session receipt `memory/sessions/2026-05-18_2016_agentremote-startup-lines-closeout.md` and learning `LRN-20260518-001`.

**Next verifiable step:** Wait for Richard. If he wants validation, live-test screenshot paste in AgentRemote main chat and embedded terminal, then edit an agent's startup line fields and confirm `agents.json` reflects the intended `startup_lines`.

**If that step fails:** For paste failures, inspect the Electron clipboard image path and `send-chat-message` payload first. For startup-line failures, compare renderer `startupLines`, main-process `startup_lines`, and `launch-agent.sh` `STARTUP_LINES`.

**Pending uncommitted diff:** none after `/done` closeout commit.

## Open priorities (<=5)

- [WAIT] **Live image-paste verification** — Richard needs to paste a screenshot into AgentRemote main chat and embedded terminal after relaunch; code and tests are complete.
- [WAIT] **AgentRemote Deploy permanent fix** — clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy; not part of this startup-injection task.

## Cross-session comms

_None._
