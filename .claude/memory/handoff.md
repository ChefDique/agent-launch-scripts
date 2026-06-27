# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last worked: 2026-06-26.** `ALS-LOCAL-016` is code-complete in `9888d8f`
(AgentRemote **v1.6.3**) and is waiting on exactly one live deploy check. The
launcher no longer synthesizes `/lead-gogo` when persisted `startup_slash` is
empty or missing; AgentRemote keeps `/lead-gogo` only as the new-agent create
default and preserves explicit empty edits.

**NEXT VERIFIABLE STEP:** in the canonical v1.6.3 HUD, confirm kenpachi still has
`startup_slash=""`, deploy kenpachi, and verify `/lead-gogo` does not run. Do not
change the field before deploying. After that live proof, move `ALS-LOCAL-016`
from `review_pending` to `done` and resume `ALS-DESIGN-001`.

Local proof: launcher regression passed after a recorded red failure;
renderer-static 46/46; Swarmy AgentRemote runtime 36/36; lead-startup positive
and negative audits passed; syntax/JSON/diff checks passed. Full `npm test` is
189/190 because the pre-existing unrelated
`agent-transcript-source.test.js:201` test still fails.

**MANDATE for next session (Richard, verbatim intent):** *"you are doing the bare
minimum for improvement instead of just making this a badass app. take a broader
approach... completely improve the design and utilize electron skills... there
should be chains of skills planned for each task in advance."* So next session is
design-led and ambitious — **headline task = `ALS-DESIGN-001`** — not a list of
small fixes. See memory `feedback_broader_approach_badass_app`.

### ▶ THE PLAN LIVES IN THE TASK BOARD — `memory/tasks/tasks.json`
Do NOT re-derive the plan here. Read the board: the **inbox** tasks are the
next-session work and **each carries a planned `skill_chain`**. Execute them
specialist-led (`.claude/agents/tmux-electron-master.md`), brainstorm-first,
verified LIVE. Current inbox (priority order):
- **`ALS-DESIGN-001` (HEADLINE, critical)** — elevate AgentRemote into a badass,
  design-led app. Multi-phase against DESIGN.md + the $10k quality bar. Chain:
  brainstorming → frontend-design → premium-frontend-ui → motion-design →
  interaction-design → icon-design → excalidraw → 21st.dev MCP → electron-expert
  → verify. PLAN THE PHASES up front (this task or a dispatched Plan agent) before
  coding.
- **`ALS-LOCAL-020` (high)** — source electron skills into skillvault (they are
  NOT in the vault; the zero-context catalog that had them disconnected). Unblocks
  the electron parts of the design work + BUG A.
- **`ALS-LOCAL-016` (review_pending)** — code complete in `9888d8f`, v1.6.3.
  Empty/removed persisted startup means NONE; `/lead-gogo` remains only the
  new-agent create default. Only the live kenpachi deploy proof above remains.
- **`ALS-LOCAL-017` (high)** — BUG A full window-close. iTerm `close` verb no-ops
  on a window with a running `tmux attach` (PromptOnQuit=1); ghost is already gone.
  Use tmux-native teardown (`; exit` or detach-client). LRN-20260619-003.
- **`ALS-LOCAL-019` (high)** — regenerate package-lock; the electron devDep subtree
  (~70 entries) lacks resolved/integrity → clean `npm ci` fails (public-release blocker).
- **`ALS-LOCAL-018` (medium)** — Attach button → plain-attach single window (still
  uses -CC + break-pane).

### ⚠️ SAFETY — read before any tmux kill
The Neo session may be running **inside** the `agentremote` tmux session it manages
(on 2026-06-19 it was the only live pane, `%1`). Killing that session/server kills
Neo. Confirmed near-miss: "kill the vegeta session" — no live vegeta existed; the
session was Neo itself. Always check `$TMUX_PANE` + real processes before any kill.
Memory: `reference_neo_may_run_inside_agentremote`.

### What shipped this session (on `main`, pushed) — done tasks in the board
- `ALS-LOCAL-016` code (`9888d8f`, v1.6.3) — explicit empty `startup_slash`
  remains empty across AgentRemote and `launch-agent.sh`; local gates pass. Task
  stays `review_pending` until the one live deploy check.
- `ALS-LOCAL-013` (`a150668`, v1.6.1) — viewer = plain `tmux attach`, one window,
  close-not-miniaturize. BUG B. Proven live + Richard's kenpachi deploy.
- `ALS-LOCAL-014` (`02930b7`) — kenpachi identity-leak in launch-agent.sh. Repro
  test (fails without fix). Richard live-confirmed force-kill.
- `ALS-LOCAL-015` (`5b10afa`, v1.6.2) — paste hint + `[data-tooltip]` system.
- `2fbb2ec` — preserved app-generated `auto_restart:false` registry edit.
- Tests: remote-app JS 188/189 (1 pre-existing `agent-transcript-source:201`);
  launch-agent runtime tests pass incl the new repro.

### Skills + docs that worked (reuse)
`attach-tmux` (skillvault) + `tmux.wiki/Control-Mode.md` for the viewer model;
`systematic-debugging`/`test-driven-development` for the identity bug. Electron
skills are NOT in skillvault yet (`ALS-LOCAL-020`). Live-test the viewer via an
ISOLATED throwaway tmux session + osascript window/client counting — never mutate
`agentremote`. Process gates: operator-contract, LEARNINGS (LRN-20260619-001/002/003),
karpathy-guidelines (simplest fix, surgical, verify), feedback memories.

## Open priorities (<=5) — all tracked in memory/tasks/tasks.json
- **[#1]** `ALS-LOCAL-016` — run the single live kenpachi deploy check, then close.
- **[#2]** `ALS-DESIGN-001` — design-led elevation (the broader-approach mandate).
- **[#3]** `ALS-LOCAL-017` — BUG A full-close hardening.
- **[#4]** `ALS-LOCAL-019` — package-lock regen (public-release blocker).
- **[#5]** `ALS-LOCAL-018` — Attach button plain-attach alignment.

## Cross-session comms
- None outstanding.
