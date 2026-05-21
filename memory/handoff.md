# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Wired `startup_injection` onto all 7 Claude fleet agents so they auto-dismiss the dev-channels warning + run startup on launch/restart; diagnosed Richard's "Shift+Return hits all panes" as iTerm Broadcast Input. Opus-Neo, 2026-05-21.

**State at last pause (2026-05-21T10:09:45-0700):**
- Startup fix: all 7 Claude agents (mugatu/xavier/08_creative/neo/zoolander/hansel/lucius) now carry `startup_injection.include = [dangerous_permission_enter, startup_lines]`; xavier/hansel excludes removed. Verified the blocker is the `--dangerously-load-development-channels` prompt, a single Enter clears it, renders ~2.5s < the 4s ack delay. Tests pass. Committed `38f5ff2`, NOT pushed.
- iTerm "Shift+Return → all panes / extra CRs" = iTerm Broadcast Input (⌘⌥I), not tmux/scripts. tmux synchronize-panes OFF; fleet is 6 panes in one control-mode window. Fix = Shell → Broadcast Input → None. See [[project_iterm_broadcast_extra_cr]].
- agents.json is TRACKED (prior "gitignored" handoff note was wrong).

**Next verifiable step:** Push `38f5ff2` when Richard asks. Otherwise resume the ALS-LOCAL-001 live paste check.

**If that step fails:** Stop before mutating live tmux/sidecar state. First list expected protected identities, observed panes, sidecar entries, exact mutation, rollback, sibling-preservation check.

**Pending uncommitted diff:** none.

## Open priorities (<=5)

- [REVIEW-PENDING] **ALS-LOCAL-001 image paste** — live check owed; uses `[image:/path]` text ref, NOT OSC 1337 (stale note; spec REQ-A4).
- [BLOCKED-SWARMY] **ALS-QUALITY-005 unsupported Codex model worker launches** — Swarmy-owned.
- [PARTIAL] **ALS-QUALITY-007 live AgentRemote verification** — send/submit verified; paste/attach/voice still need approved live checks.
- [FOLLOWUP] **HUD-managed non-Claude startup injection** — `applyRuntimePolicy` (`remote-app/main.js` ~735/~2298) strips `startup_injection` from non-Claude on UI-edit; lift only if Codex HUD injection is wanted.

## Cross-session comms

- None outstanding.
