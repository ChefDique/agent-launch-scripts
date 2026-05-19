# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote v1.4.9 embedded terminal keyboard and selection ergonomics.

**State at last pause (2026-05-18T20:32:41-0700):**
- Branch `codex/agentremote-terminal-keybindings` adds embedded xterm Option/Alt word navigation and word delete: Alt+Left/Right, Alt+B/F, Alt+Backspace, Alt+Delete, and Alt+D.
- Embedded xterm now opts its internal layers out of Electron drag regions and enables selection options so mouse selection/right-click word selection can work without dragging the HUD.
- Existing terminal image/text paste paths were preserved: paste shortcut still rejects Alt, keeps Ctrl/Cmd+V and Ctrl+Shift+V, and keeps the raw `0x16` fallback.
- Spark workers implemented keyboard and selection lanes; Spark analysis confirmed the copied-image-link clue comes from clipboard sources that expose both text and native image data.
- Verification passed so far: `node --test test/renderer-static.test.js`, `npm run test:policy`, `npm test`, `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`, `jq . agents.json`, `git diff --check`, Swarmy `test_agentremote_runtime.py`, and isolated tmux byte checks for ESC-based shortcuts.

**Next verifiable step:** Commit, merge to local `main`, run AgentRemote cleanup/relaunch from the canonical checkout, then Richard should live-test word navigation/delete and mouse selection in an embedded terminal.

**If that step fails:** Inspect the xterm `attachCustomKeyEventHandler`, `pane-input` literal tmux send path, and Electron drag/no-drag CSS for `#xterm-host` internals before changing launcher/tmux runtime code.

**Pending uncommitted diff:** v1.4.9 embedded terminal keyboard/selection patch plus recovery-list and handoff updates.

## Open priorities (<=5)

- [WAIT] **Live image-paste verification** — Richard needs to paste a screenshot into AgentRemote main chat and embedded terminal after relaunch; code and tests are complete.
- [REVIEW] **Embedded terminal keyboard/mouse ergonomics** — v1.4.9 code/tests are complete; needs canonical relaunch and Richard live verification for Option word shortcuts plus mouse selection.
- [WAIT] **AgentRemote Deploy permanent fix** — clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy; not part of this startup-injection task.

## Cross-session comms

_None._
