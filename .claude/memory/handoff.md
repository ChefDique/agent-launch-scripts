# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Fixed the `/message-agent` send bug (two-phase tmux submit) and pushed both repos to origin. Opus-Neo, 2026-05-21.

**State at last pause (2026-05-21T16:46:00-0700):**
- `/message-agent` SEND BUG FIXED + verified live + pushed: deliveries used to land in the agent's composer but not submit (intermittent). Root cause = delay placed after the submit + a `C-m`+`Enter` double-submit in `agent_bus_listener.py`. Fixed to the HUD's two-phase pattern (paste → 0.15s → single Enter). Commit `3c9509c` in the **message-agent repo** (`~/ai_projects/tools/message-agent`), pushed. 26/26 listener tests pass; proven against a throwaway Claude pane.
- `agent-launch-scripts` ALL PUSHED to origin (`c3b2050`): startup warning default-on (`80128ea`), "Startup auto-run" toggle v1.4.16 (`76ebc52`), `tmux-masta`→`neo` rename (`acd7d10`), live registry, chores. Both repos now in sync with origin.
- Toggle: Richard satisfied — default-on is the real win, the toggle is an optional override.
- CLOSEOUT (16:46): `/done` ran; `session-end-cleanup` stopped Richard's live HUD and he said "don't close my shit" — relaunched immediately, v1.4.16 is up (detached). Neo session left RUNNING (skipped `/done`'s kill-PID per his call). Never close his running apps or kill the session on closeout — see [[feedback_dont_close_richards_running_apps]].

**Next verifiable step (NEXT-SESSION PRIMARY):** AgentRemote public-release READINESS — NOT the simplest path; the MVP is buggy/broken and can't ship as-is (Richard would be "bothered non-stop"). Review-first approach: (1) ASK Richard where the MVP lives (`remote-app/` here vs a separate build he has); (2) dispatch a couple of architect reviews (`tmux-electron-master` on Electron/tmux + send/attach; release-readiness/de-Richard-ify; secrets/paths sweep); (3) converge ONE prioritized list (broken → blockers → fix order); (4) he steers, THEN fix. Plus the $10-vs-open-source call. Brainstorm/review FIRST, build only on his green light. Full brief: [[project_agentremote_public_release]]. (Also open: Shift+Enter cross-pane CR.)

**If that step fails:** n/a — no in-flight work.

**Pending uncommitted diff:** none.

## Open priorities (<=5)

- [NEXT-SESSION PRIMARY] **AgentRemote public release prep + monetization** — prepare `remote-app/` for public release; $10 one-time vs open-source funnel; popular on TikTok. Brainstorm/plan first, Richard decides. See [[project_agentremote_public_release]].
- [OPEN] **Shift+Enter → extra CRs in all panes** — Richard confirmed it persists; he uses Shift+Enter deliberately to avoid sending. Cause unconfirmed (iTerm broadcast rejected). Needs: agent pane vs HUD composer. Bus double-submit removal quiets one code-side CR source but isn't this mechanism. See [[project_iterm_broadcast_extra_cr]].
- [REVIEW-PENDING] **ALS-LOCAL-001 image paste** — live check owed; uses `[image:/path]` text ref, NOT OSC 1337.
- [BLOCKED-SWARMY] **ALS-QUALITY-005 unsupported Codex model worker launches** — Swarmy-owned.
- [PARTIAL] **ALS-QUALITY-007 live AgentRemote verification** — send/submit verified; paste/attach/voice still need approved live checks.

## Cross-session comms

- None outstanding.
