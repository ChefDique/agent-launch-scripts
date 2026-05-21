# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Fixed the core "send-keys not submitting / have to press Enter manually" bug (ALS-LOCAL-006 + ALS-LOCAL-008), and integrated the prior Codex-Neo dirty work as logical commits. Opus-Neo, 2026-05-21.

**State at last pause (2026-05-21):**
- ROOT CAUSE + FIX shipped (v1.4.15) and LIVE-VERIFIED: the send path delivered literal text and Enter in ONE tmux invocation, so a raw-mode TUI (Codex/Claude) read text+CR in one read() as a paste (newline in composer) instead of submitting. Fix = two-phase send: literal text, then Enter after `TMUX_SUBMIT_ENTER_DELAY_MS` (120ms) so the Enter lands in its own read as a deliberate keypress. Applied to both the broadcast/composer path (`sendKeysToCoord`) and the embedded-terminal submit path (`submitPaneText`). Empirically proven: integration tests show two-phase = 2 separate reads (submits), combined = 1 fused read (the bug). 145 node tests pass.
- `ALS-LOCAL-006` and `ALS-LOCAL-008` → `done`. Richard relaunched the HUD at v1.4.15 and confirmed a live test send submitted on its own with no manual Enter ("test" -> "success").
- Committed in logical units: gitignore graphify scratch; app-code (xhigh, owner-matching, Option+Backspace); the two-phase Enter fix; v1.4.15 bump; launcher cluster (department resolution, registry pane titles, cleanup script).
- DEFERRED, NOT committed: `agents.json` — its dirty diff flips the whole fleet (mugatu/xavier/lucius) from `runtime: codex` to `runtime: claude` (opus-4-7, reasoning max). That contradicts the CLAUDE.md Codex-priority policy AND the live state (panes are running Codex, `cmd=2.1.143`). `agents.json` is also gitignored (machine-local). Left dirty pending Richard's call on whether the fleet should actually be on Claude.
- Live `chq` at this session: 5 agents share ONE window as split panes (`chq:0.0`–`0.4`: Xavier, MUGATU, GOKU, NEO, LUCIUS) — violates one-agent-per-window, but layout is Swarmy's runtime domain.

**Next verifiable step:** HUD relaunched at v1.4.15 (PID was 61720) and Enter fix is live-verified. Remaining open item: decide the `agents.json` codex-vs-claude question (currently deferred/uncommitted). Image paste (ALS-LOCAL-001) still wants a dedicated live paste check.

**If that step fails:** Stop before mutating live tmux or sidecar state. First list expected protected identities, observed panes, sidecar entries, exact mutation, rollback, and sibling-preservation check.

**Pending uncommitted diff:** `agents.json` only (deferred fleet-flip, see above). Everything else is committed on `main` (not pushed). Separate Swarmy repo may still be dirty; out of this lane's scope.

## Open priorities (<=5)

- [DONE] **ALS-LOCAL-006 simultaneous/timed Enter** — two-phase send (v1.4.15); live-verified after HUD relaunch.
- [DONE] **ALS-LOCAL-008 tmux fallback submit failure** — same root cause + fix as 006; live-verified.
- [DEFERRED] **agents.json fleet-flip** — dirty diff flips fleet codex→claude; contradicts Codex-priority policy + live state; left uncommitted for Richard's call.
- [REVIEW-PENDING] **ALS-LOCAL-001 image paste** — image paste path uses explicit submit flag → now two-phase; live verification still needed.
- [BLOCKED-SWARMY] **ALS-QUALITY-005 unsupported Codex model worker launches** — Swarmy-owned.
- [BLOCKED] **ALS-QUALITY-007 live AgentRemote verification** — not passable until the runtime/input mess is cleaned up and live-verified.

## Cross-session comms

- 2026-05-20 Neo -> overlordswarmy: message-agent failed with connection refused and deadlettered as `neo-codex-to-overlordswarmy-1779266195`.
- 2026-05-20 Neo -> Swarmy pane `%1083`: tmux fallback placed a long report into Codex's queued input but did not prove submission; do not count it as delivered.
