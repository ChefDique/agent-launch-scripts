# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Failed AgentRemote terminal/image-paste/debugging closeout after repeated false-positive fixes.

**State at last pause (2026-05-19T00:54:10-0700):**
- Richard explicitly rejected prior success claims: image paste, Option-key editing, and popup sizing remain unproven/broken in the live operator workflow.
- Do not conflate issues: image paste is clipboard-image -> iTerm2 OSC 1337 inline image/file protocol, with `MultipartFile`/`FilePart`/`FileEnd` required for tmux integration mode; keyboard shortcuts are a separate Option/Meta key-sequence problem.
- Prior patches/commits exist (`07f75ea`, `5ca26ba`, `bd602b2`) but must not be treated as proof. Static tests and tmux key tables did not equal live UX validation.
- AgentRemote was relaunched earlier; do not relaunch, restart panes, or mutate the live iTerm/tmux desktop without explicit permission.
- User feedback is severe: trust is damaged because repeated frontier-model/max-thinking attempts produced wrong framing, fake validation, scope drift, and new UI breakage.

**Next verifiable step:** Build an isolated throwaway `tmux -CC` reproduction that captures exactly what iTerm2 sends/accepts for image paste and Option-key editing, then document the bytes/protocol before any production patch.

**If that step fails:** Stop and report the exact failed capture/protocol evidence. Do not patch AgentRemote from assumptions.

**Pending uncommitted diff:** memory closeout only until committed.

## Open priorities (<=5)

- [BLOCKED] **AgentRemote image paste in iTerm/tmux control mode** — implement only after an isolated proof of iTerm2 OSC 1337 `MultipartFile`/`FilePart`/`FileEnd` behavior through `tmux -CC`; do not use `[image: /tmp/file]` text markers as the fix.
- [BLOCKED] **AgentRemote Option-key editing** — diagnose separately from image paste; capture live Option+Left/Right/Backspace bytes in throwaway control-mode tmux before touching production keymaps.
- [BLOCKED] **AgentRemote popup sizing/clipping** — visible screenshot shows add/edit popup still clipped; previous dynamic resize fix is incomplete.
- [WAIT] **AgentRemote Deploy permanent fix** — clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy; not part of the terminal/resize closeout.

## Cross-session comms

_None._
