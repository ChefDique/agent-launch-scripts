# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote add/edit form sizing fixed and relaunched.

**State at last pause (2026-05-19T04:00:22-0700):**
- Fixed the clipped AgentRemote add/edit form in `remote-app/index.html`: the form now receives a renderer-computed visible-height clamp, reserves room for lower panel rows, and keeps the action bar sticky while internal scrolling remains available.
- Bumped AgentRemote to `v1.4.11` and added static regression coverage in `remote-app/test/window-geometry.test.js`.
- Verification: full `remote-app` test suite passed; fresh Electron renderer checks for both Add and Edit mode reported `actionsVisible=true`, `formBottomVisible=true`, and `panelBottomVisible=true`. Screenshot artifacts: `output/playwright/agentremote-add-form-visible-actions.png` and `output/playwright/agentremote-edit-form-visible-actions.png`.
- Committed and pushed `1fb8faa fix(remote): keep agent form actions visible`; relaunched AgentRemote from the canonical checkout. Existing unrelated `agents.json` diff was preserved and not staged.

**Next verifiable step:** If Richard still sees clipping, inspect the live relaunched window bounds first and compare against the saved renderer reports before changing code again.

**If that step fails:** Re-run the Electron renderer CDP check against the exact visible app process or use a macOS window screenshot; do not claim done from static tests alone.

**Pending uncommitted diff:** `agents.json` only; pre-existing startup-lines change for `mugatu-claude`, intentionally left untouched.

## Open priorities (<=5)

- [DONE] **AgentRemote popup sizing/clipping** — fixed in `1fb8faa`; Add/Edit action buttons now remain visible with internal scroll fallback.
- [WAIT] **AgentRemote Deploy permanent fix** — clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy; not part of the terminal/resize closeout.

## Cross-session comms

_None._
