# AgentRemote Non-Regression Spec

**Purpose:** the canonical "**don't break X to fix Y**" requirements for AgentRemote and its launchers. Each requirement is a `MUST`/`MUST NOT` paired with the fix it historically collides with, the evidence behind it, and the guard that proves it. Derived by mining `memory/sessions/` + `.learnings/LEARNINGS.md` and diffing against the live `remote-app/` code (2026-05-21).

This is the *what must hold* layer. Its companions:
- `agentremote-quality-gates.md` — *how to test* each surface (blast-radius matrix).
- `agentremote-operator-contract.md` — *what Richard wants* for spawn/layout/runtime/window/messaging.
- `../agentremote-reference.md` — *how the app works now* (architecture, current behavior).

## How to use this before any AgentRemote change

1. Find the **cluster** you are touching below.
2. Read its requirements **and the "Collides with" column** — those are the behaviors your change is most likely to break.
3. Run/extend the listed **Guard** for both the requirement you are changing **and** every requirement it collides with. A green test on your change alone is not enough when it sits in a collision cluster.
4. For input / paste / spawn / layout / runtime behavior, a static-test pass is **not** a PASS — get Richard's live operator-workflow verification (REQ-G2).

Evidence keys: `S:<date>` = `memory/sessions/<date>_*.md`; `LRN-*` = LEARNINGS entry; `ALS-*` = task id.

---

## Cluster A — Embedded terminal input & send/submit  *(the tightest collision cluster)*

Every historical attempt to fix one of {send/submit, Enter handling, Option word-edit, text paste, image paste} has endangered the others. Treat A1–A5 as one regression set: touching any one requires re-proving all five.

| ID | Requirement | Collides with (don't break) | Evidence | Guard |
|---|---|---|---|---|
| **A1** | Send means **send AND submit**. A composed/typed/voice/paste-submit message MUST be delivered *and* submitted at the target pane. Text and Enter MUST arrive in **separate reads** (two-phase: literal text, then Enter ≥ `TMUX_SUBMIT_ENTER_DELAY_MS` later). MUST NOT be fused into one `send-keys ... Enter` invocation — a raw-mode TUI reads the fused form as a paste and never submits. | A2, A4; any send-path refactor that re-fuses text+Enter; the old Enter-focus guard | LRN-20260521-001; S:2026-05-20_0108; S:2026-05-20_0217 (ALS-006/008) | `test/tmux-send-path.integration.test.js` (2 reads vs 1) + `tmux-send-path.test.js`; live send. **Held + live-verified 2026-05-21 (v1.4.15).** |
| **A2** | Option/Alt word-edit keys MUST keep working in the embedded terminal: Option+Backspace→`C-w`, Alt+←/→ word nav, Alt+B/F/D. They are a **Meta-sequence transport** problem, separate from paste. | A1, A4; Enter-handling and paste-path edits | S:2026-05-18_2200; S:2026-05-20_0217; `tmux-masta.md` | `test/terminal-input.test.js`; live word-edit in a real Codex prompt |
| **A3** | Text paste MUST NOT auto-submit, and MUST NOT forward raw control bytes (e.g. a lone `0x16`/SYN from plain Ctrl+V is treated as paste, never sent raw). Only the explicit `submit` flag submits. | A1; Ctrl+V / SYN handling | LRN-20260508-004; quality-gates Paste row | `renderer-static.test.js`; live paste |
| **A4** | Image paste MUST produce a **readable reference the agent can act on**. Current shipped mechanism: save to `/tmp/agentremote-pasted-images/`, insert `[image: /path]` text, then submit via the delayed-Enter (A1) path. MUST keep working whenever terminal-input/Enter handling changes. | A1, A2; raw-byte/keyboard forwarding (the failed approach) | LRN-20260508-004; S:2026-05-19_0054; ALS-LOCAL-001 (review_pending) | `renderer-static.test.js` + `tmux-send-path` tests; **live paste check still owed** |
| **A5** | A standalone Enter in the embedded terminal is a real keypress to the **active agent's pane only**, sent isolated (not fused with text). MUST NOT send a stray Enter to a non-target pane. | A1, D2 (pane targeting) | S:2026-05-20_0108/_0217 | pane-resolver owner-matching + A1 guards; live |

> **Reconciliation (diff finding):** `memory/agent-notes/tmux-masta.md` records that image paste "must" use the **iTerm2 OSC 1337 multipart protocol**. That was a *diagnosis from a failed session*, **not** the shipped solution — the current code uses the `[image: /path]` text-reference path and there is **no OSC 1337 transport in `remote-app/`**. Do **not** rip out the working text-reference path to implement OSC 1337 without Richard's explicit direction. This note exists so the stale memory entry does not trigger a regression.

---

## Cluster B — Runtime / model / reasoning / startup injection

| ID | Requirement | Collides with | Evidence | Guard |
|---|---|---|---|---|
| **B1** | Model/runtime/reasoning selection MUST round-trip: picker → `agents.json` → `launch-agent.sh` → live pane. The HUD MUST be relaunched to pick up catalog/default changes (a stale HUD shows old options). | harness-models/registry edits; stale HUD | S:2026-05-19_2229; S:2026-05-20_0108/_0217 (ALS-005) | `harness-models.test.js`, `runtime-dynamic-contract.test.js`; live picker |
| **B2** | Reasoning normalization MUST preserve an explicit value (especially `xhigh`) and not normalize it away. Codex default reasoning is `xhigh`. | reasoning/thinking normalization logic | S:2026-05-20_0108 (ALS-005) | `harness-models.test.js`; registry inspection |
| **B3** | A `runtime: "claude"` entry MUST carry `allow_claude_runtime: true`; never launch Claude from a Codex path. Codex is the priority runtime while Claude tokens are constrained. | runtime defaults; registry flips | CLAUDE.md; `applyRuntimePolicy` | launcher tests; registry gate check |
| **B4** | Startup injection is a **per-agent toggle** (`startup_injection` policy), **runtime-agnostic** (Richard 2026-05-21). An agent with no policy gets NOTHING injected — no stray Enter or lines (the safety the old Claude-only gate provided). The warning-ack is a timed keypress (default Enter; `warning_ack_keys` configures e.g. `["1","Enter"]`); injected lines submit via two-phase (text then delayed Enter); the startup command goes via injection OR argv, never both. Claude-only slash commands (`/color`, `/rename`) MUST NOT be injected into non-Claude panes. | startup-injection / launcher refactors; the old "Claude-only" assumption | S:2026-05-20_0108; S:2026-05-19_2229; LRN-20260508-003 (now generalized) | `test/launch-agent-runtime.test.sh` (codex-policy + warning-keys cases) |
| **B5** | Explicit `startup_lines` drive Claude startup; legacy `/color`+`/rename`+`startup_slash` fallback runs ONLY when `startup_lines` is absent. Generated fallback values MUST stay **display-only** — never persisted to `agents.json` on an unrelated edit. | add/edit form save logic | LRN-20260518-001; S:2026-05-18_2016 | `renderer-static.test.js` (configured-bit guard) |
| **B6** | Model/provider rejection (bad model, Claude-from-Codex, unsupported worker model) MUST be enforced in `launch-agent.sh` + `agents.json` + `config/harness-models.json` — **NOT** in the Codex lifecycle hook or chat-phrase guards. | enforcing model policy via hooks/text guards | S:2026-05-20_0538 | launcher/config tests |

---

## Cluster C — Launcher invariants

| ID | Requirement | Collides with | Evidence | Guard |
|---|---|---|---|---|
| **C1** | The Codex launch command MUST preserve `--no-alt-screen`, the configured startup command (e.g. `/lead-gogo`), and the pane title. These MUST NOT drift out while chasing a TUI/visual symptom. | launcher refactors; AgentRemote TUI tweaks | S:2026-05-19_0107; S:2026-05-20_0108; `tmux-masta.md` (2026-05-20) | `test/chq-codex-runtime-smoke.test.sh`, `launch-agent-runtime.test.sh` |

---

## Cluster D — Spawn / attach / layout / viewer / targeting

| ID | Requirement | Collides with | Evidence | Guard |
|---|---|---|---|---|
| **D1** | One agent process → one tmux pane → its own tmux window → surfaced by iTerm control mode. MUST NOT use a plain `tmux attach` viewer or a merged split-pane window as a workaround. | attach/deploy shortcuts | operator-contract; quality-gates | `deploy-viewer.test.js`, `iterm-attach.test.js`, `layout-policy.test.js`; approved live deploy |
| **D2** | Pane targeting MUST resolve sidecar `pane_id` first, then title, with `@agent-identity` owner-matching to reject wrong-pane delivery. No title-grep-only targeting. | resolver/targeting changes | LRN-20260509-001; S:2026-05-20_0217 | `pane-resolver.test.js` |
| **D3** | spawn / attach / restore / kill / restart / send MUST be **verified at the live target** (present in `chq` + has a `/tmp/agent-remote-panes.json` entry). No optimistic success. | optimistic success reporting | S:2026-05-20_0217; S:2026-05-19_0107 | `deploy-viewer` safety checks; live inspection |
| **D4** | Swarmy owns the deploy/attach/stop/layout runtime (`agentremote_runtime.py`) and the wrapper-pane launch path (e.g. a pane surfacing `bash` as its command). Neo MUST NOT patch Swarmy's launch-runtime without explicit permission. | cross-repo edits | S:2026-05-20_0217; CLAUDE.md | n/a (boundary) |

---

## Cluster E — Pet chat / voice

| ID | Requirement | Collides with | Evidence | Guard |
|---|---|---|---|---|
| **E1** | Pet chat reads the structured transcript source for Claude/Codex; pane scraping is fallback only. Filtering is a shared, registry/policy-driven classifier — NO per-agent/per-model/per-runtime renderer branches. Route by `from`/`to` identity, not name-mention. Scrollback MUST NOT yank to bottom while scrolled up. | per-agent filter hacks; broad mention routing | LRN-20260508-005/006/007 | `pane-stream-filter.test.js`, `agent-transcript-source.test.js` |
| **E2** | Voice uses the local `whisper` CLI (no silent network STT fallback). Hold-to-talk feedback MUST be truthful, and the transcript goes to the selected target only. | STT path changes | quality-gates Voice row | renderer/static voice tests; live record |

---

## Cluster F — UI / window sizing & styling

| ID | Requirement | Collides with | Evidence | Guard |
|---|---|---|---|---|
| **F1** | The add/edit form, settings popover, and popups MUST size to content without clipping Save/Cancel — proven against **live renderer bounds** (screenshot + visibility booleans like `actionsVisible`/`formBottomVisible`), not just a resize-intent assertion. The fallback height MUST reserve room for the dock and lower-panel rows. | `syncWindowSize`-only fixes | `tmux-masta.md` (2026-05-19); S:2026-05-19_0054/_0107 | `window-geometry.test.js` + live screenshot |
| **F2** | Every scrollable modal/picker/popover/overlay/roster/log/pet window MUST use the dark HUD scrollbar styling. Native white scrollbars are regressions. | new scrollable surfaces | CLAUDE.md; operator-contract | visual / static |

---

## Cluster G — Process & verification discipline

| ID | Requirement | Collides with | Evidence | Guard |
|---|---|---|---|---|
| **G1** | For any live behavior mismatch, rule out **stale live process drift first** (compare pane process age + command across panes). Restart only the **stale wrapped child**; the wrapper parent MUST survive to auto-restart. NEVER blanket-kill tracked processes. Live panes do not inherit launcher/config changes until the child restarts. | jumping to renderer/tmux code patches; blind kills | S:2026-05-19_0107; S:2026-05-20_0538; `tmux-masta.md` | diagnostic discipline (not a unit test) |
| **G2** | No completion/PASS for runtime / input / paste / spawn / layout / Armory-import / avatar work without **live operator-workflow verification approved by Richard**. Static tests reduce blast radius; they are not a PASS. | declaring success on `npm test` alone | S:2026-05-19_0054; S:2026-05-19_2229; S:2026-05-20_0217; operator-contract "Proof Before PASS" | live check + approval |
| **G3** | Closeout MUST be truthful: do not commit unsafe/unverified runtime-input changes, and do not mutate live iTerm/tmux/AgentRemote desktop in guarded lanes without Richard's explicit ask in the current turn. | optimistic closeout; live mutation without approval | S:2026-05-20_0217; `session-status.json`; LRN-20260520-001 | closeout discipline |

---

## Diff findings (session history vs docs/code, 2026-05-21)

What this spec **adds or reconciles** beyond the prior docs:

1. **A1 two-phase "separate reads" rule** — newly shipped (v1.4.15) and now stated as a hard invariant; the old quality-gates "one ordered send+submit" wording predates it.
2. **A4 image-paste reconciliation** — the stale `tmux-masta.md` OSC-1337 note is flagged as a non-shipped diagnosis so it cannot trigger a regression of the working text-reference path.
3. **C1 launcher-invariant drift** — promoted from a session note to an explicit requirement after `--no-alt-screen`/startup-command drift cost real sessions.
4. **G1 stale-process-first diagnostic** — promoted from `tmux-masta.md` notes; this single discipline would have saved the 2026-05-19 wasted session.
5. **F1 live-bounds proof for sizing** and **B6 model-gating placement** — under-captured in the surface matrix; stated here as MUST requirements.

Empty memory dirs noted during mining: `memory/audits/`, `memory/decisions/`, `memory/workflows/`, `memory/coord/` are placeholders only. Durable requirements currently live in `memory/agent-notes/tmux-masta.md`, the session files, and `.learnings/LEARNINGS.md`.
