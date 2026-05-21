# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Shipped the Claude-fleet startup-warning auto-ack fix; walked back a wrong cross-pane-CR diagnosis after Richard rejected it. Opus-Neo, 2026-05-21.

**State at last pause (2026-05-21T10:35:00-0700):**
- DONE + stands: all 7 Claude agents (mugatu/xavier/08_creative/neo/zoolander/hansel/lucius) now carry `startup_injection.include = [dangerous_permission_enter, startup_lines]`, so each auto-dismisses the `--dangerously-load-development-channels` warning (single Enter, verified, renders ~2.5s < 4s ack) and runs startup on launch/restart. Tests pass. Committed `38f5ff2`, NOT pushed.
- OPEN: "Shift+Return → extra CRs in all panes." I hypothesized iTerm Broadcast Input and wrongly committed it as fact; **Richard rejected it ("def not")**. Cause unconfirmed. Memory corrected. Need from Richard: WHERE he presses Shift+Return (agent iTerm/tmux pane vs AgentRemote HUD) — routes iTerm/system vs a `remote-app/` send bug. See [[project_iterm_broadcast_extra_cr]].
- agents.json is TRACKED (prior "gitignored" handoff note was wrong).

**Next verifiable step:** Get Richard's answer on where Shift+Return is typed, then investigate that layer (don't re-assert a cause first).

**If that step fails:** Stop before mutating live tmux/iTerm/sidecar state. List expected protected identities, observed panes, exact mutation, rollback, sibling-preservation check first.

**Pending uncommitted diff:** none.

## Open priorities (<=5)

- [OPEN-INVESTIGATION] **Cross-pane extra CRs from Shift+Return** — iTerm Broadcast Input hypothesis rejected by Richard; cause unconfirmed. Blocked on where he presses Shift+Return. See [[project_iterm_broadcast_extra_cr]].
- [REVIEW-PENDING] **ALS-LOCAL-001 image paste** — live check owed; uses `[image:/path]` text ref, NOT OSC 1337 (stale note; spec REQ-A4).
- [BLOCKED-SWARMY] **ALS-QUALITY-005 unsupported Codex model worker launches** — Swarmy-owned.
- [PARTIAL] **ALS-QUALITY-007 live AgentRemote verification** — send/submit verified; paste/attach/voice still need approved live checks.
- [FOLLOWUP] **HUD-managed non-Claude startup injection** — `applyRuntimePolicy` (`remote-app/main.js` ~735/~2298) strips `startup_injection` from non-Claude on UI-edit; lift only if Codex HUD injection is wanted.

## Cross-session comms

- None outstanding.
