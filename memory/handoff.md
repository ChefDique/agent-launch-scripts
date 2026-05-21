# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Rebuilt startup injection as a runtime-agnostic per-agent toggle + two-phase submit fix in `launch-agent.sh`; corrected that the live fleet is Claude. Opus-Neo, 2026-05-21.

**State at last pause (2026-05-21T08:36:00-0700):**
- Startup injection (dev-warning ack → startup-command inject) is now a **dynamic per-agent toggle**, runtime-agnostic, with the two-phase submit fix so injected `/lead-gogo` actually submits. Runs on every auto-restart; lands on the next agent restart. Isolated test green; 145 node tests pass. (commit `4d32e90`)
- Live fleet is **Claude** (Opus 4.7) — verified via the `@agent-runtime` pane tags. The on-disk `agents.json` (claude/opus-4-7) MATCHES the running fleet; it is not a contradiction (earlier "Codex" claim was a misread of `pane_current_command`).
- All work committed on `main`; NOT pushed.

**Next verifiable step:** If Richard wants HUD-managed Codex injection, lift the `applyRuntimePolicy` `startup_injection` strip (`remote-app/main.js` ~735, ~2298) + add a test. Otherwise: the `agents.json` commit decision, and the ALS-LOCAL-001 live paste check.

**If that step fails:** Stop before mutating live tmux or sidecar state. First list expected protected identities, observed panes, sidecar entries, exact mutation, rollback, and sibling-preservation check.

**Pending uncommitted diff:** `agents.json` only (gitignored, machine-local; matches the live Claude fleet; commit on Richard's call).

## Open priorities (<=5)

- [DEFERRED] **agents.json commit** — matches the live Claude fleet (not a contradiction); gitignored; commit only on Richard's call.
- [FOLLOWUP] **applyRuntimePolicy strips startup_injection from non-Claude on UI-edit** — lift if Richard wants HUD-managed Codex injection; not needed for the Claude fleet.
- [REVIEW-PENDING] **ALS-LOCAL-001 image paste** — live check owed; uses `[image:/path]` text ref, NOT OSC 1337 (stale note; spec REQ-A4).
- [BLOCKED-SWARMY] **ALS-QUALITY-005 unsupported Codex model worker launches** — Swarmy-owned.
- [PARTIAL] **ALS-QUALITY-007 live AgentRemote verification** — send/submit verified; paste/attach/voice still need approved live checks.

## Cross-session comms

- None outstanding.
