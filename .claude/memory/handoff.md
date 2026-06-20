# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last worked: 2026-06-19.** Shipped on `main`: BUG B (deploy multi-window) fixed
via plain `tmux attach`, the kenpachi kill/status identity-leak fixed, and a
tooltip system. **Richard live-confirmed:** deployed kenpachi → one window, and
menu force-kill "worked great." HUD running canonical **v1.6.2**.

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
- **`ALS-LOCAL-016` (high)** — **the /lead-gogo bug Richard hit.** He removed
  `/lead-gogo` from kenpachi (`startup_slash=""`) but it STILL ran. Root (proven,
  not a cache): `launch-agent.sh:277` forces `/lead-gogo` for Claude when
  startup_slash is empty; `main.js:61 DEFAULT_LEAD_STARTUP_SLASH`; the form
  default; AND tests (`launch-agent-runtime.test.sh:459-482`) + `scripts/audit-lead-startup.sh`
  ENFORCE it. Fix: empty/removed = NONE (honor it); default-on only for brand-new
  agents. Flip the enforcing tests + audit.
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
- **[#1]** `ALS-DESIGN-001` — design-led elevation (the broader-approach mandate).
- **[#2]** `ALS-LOCAL-016` — /lead-gogo empty=NONE fix.
- **[#3]** `ALS-LOCAL-020` — source electron skills into skillvault.
- **[#4]** `ALS-LOCAL-017` — BUG A full-close hardening.
- **[#5]** `ALS-LOCAL-019` — package-lock regen (public-release blocker).

## Cross-session comms
- None outstanding.
