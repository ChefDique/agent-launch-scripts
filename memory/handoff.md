# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Shipped + live-verified the two-phase send/submit fix (ALS-006/008), integrated prior dirty work, then wrote the up-to-date app reference and the non-regression spec. Opus-Neo, 2026-05-21.

**State at last pause (2026-05-21T07:26:00-0700):**
- Two-phase send/submit fix is LIVE at v1.4.15 and Richard-verified ("test" → "success"); root cause + details in the 2026-05-21_0726 session fold. 145 node tests pass.
- New docs: `docs/agentremote-reference.md` (how the app works now) and `docs/operations/agentremote-spec-requirements.md` (23 non-regression requirements with "don't break X to fix Y" collision pairs). Linked from docs/README + quality-gates.
- `agents.json` deferred/uncommitted: its diff flips the fleet codex→claude (opus-4-7, reasoning max), contradicting Codex-priority policy + the live Codex panes. Awaiting Richard's call.
- All work committed on `main`; NOT pushed.

**Next verifiable step:** Get Richard's decision on the `agents.json` codex-vs-claude flip — apply it or `git checkout -- agents.json` to discard. (Optional) live paste check for ALS-LOCAL-001.

**If that step fails:** Stop before mutating live tmux or sidecar state. First list expected protected identities, observed panes, sidecar entries, exact mutation, rollback, and sibling-preservation check.

**Pending uncommitted diff:** `agents.json` only (deferred fleet-flip, see above). Separate Swarmy repo may still be dirty; out of this lane's scope.

## Open priorities (<=5)

- [DEFERRED] **agents.json fleet-flip** — dirty diff flips fleet codex→claude; contradicts Codex-priority policy + live state; uncommitted, awaiting Richard's call.
- [REVIEW-PENDING] **ALS-LOCAL-001 image paste** — now routes through the two-phase submit; dedicated live paste check still owed. Note: code uses a `[image: /path]` text reference, NOT OSC 1337 (the OSC-1337 memory note is a stale failed-session diagnosis — see spec REQ-A4).
- [BLOCKED-SWARMY] **ALS-QUALITY-005 unsupported Codex model worker launches** — Swarmy-owned.
- [PARTIAL] **ALS-QUALITY-007 live AgentRemote verification** — send/submit now live-verified; remaining surfaces (paste, attach/layout, voice) still need approved live checks.

## Cross-session comms

- None outstanding. (2026-05-20 deadletter + tmux-fallback-queue items resolved: the two-phase fix means a tmux fallback now actually submits.)
