# AgentRemote — Single-Window Reliability & Code-In-Order Spec

**Date:** 2026-06-19
**Branch:** `reliability-single-window` (worktree; live HUD untouched until explicit cutover)
**Author:** Neo (`neo`)
**Process:** `superpowers:brainstorming` → this spec → `writing-plans` → `systematic-debugging`/`test-driven-development` execution. Diagnostic basis: `tmux-electron-master` read-only report (2026-06-19), all file:line citations verified against the worktree.

## 1. Goal & scope

Richard's directive: get AgentRemote's **code in order + docs updated** so it is reliable and ready to be carved into a public open-source repo in a *later* session (with a product-manager skill driving naming/packaging/license). GTM is open-source-as-funnel. This session's must-ship bar is **bugs + reliability first**.

### In scope (this session)
1. **BUG A** — right-click "Close" leaves a `[tmux detached]` window.
2. **BUG B + native spawn** — replace the swarmy shell-out with an **in-app spawn** (Richard greenlit 2026-06-19: "adjust it to operate the same way without swarmy") that puts all selected agents into one tmux session / one window as tiled panes; **collapse the 3 layout pills** (Richard: they "do the same thing") to the single-window model.
3. **Button/IPC audit** — every control works; remove dead/duplicate handlers.
4. **Architecture in order** — decompose the `main.js` IPC backend into focused, testable modules (build on existing extracted modules).
5. **Docs** — rewrite the operator contract's layout/runtime sections for the single-window default; update `launch-scripts.md`; this spec.

### Deferred (future public-extraction / PM session)
- **Embedded-terminal** rendering that replaces iTerm control-mode entirely (zero macOS/iTerm coupling). This session removes the *swarmy* dependency from spawn; replacing the iTerm viewer with an in-app xterm surface is the next increment.
- Renderer (`index.html`, 9,947 lines) decomposition.
- Packaging, signing/notarization, naming, license, README/landing, repo extraction.
- Codex **custom pet creation** feature (bonus) — only if core lands with time to spare.

## 2. BUG A — "Close agent" leaves a detached window

**Root cause (confirmed):** the radial "Close" orb (`index.html:5489` → `doKillPane` `index.html:6614`) calls IPC `kill-pane` (`main.js:2595-2625`), which runs **only** `tmux kill-pane -t <coord>` (`main.js:2614`). When that pane is the **last pane in its solo tmux window**, tmux closes the window, but the iTerm control-mode (`tmux -CC`) native window does not close — it shows `[tmux detached]` and lingers. The agent genuinely dies (swarmy's `pane-died` respawn targets a now-removed pane id), so the symptom is window-only. This already violates the operator contract's Window Hygiene ("detached viewers … are failures").

**Fix (`main.js` kill loop ~`2611-2621`):** per matched pane — capture its window target and `window_panes` count (`tmux display-message -p '#{window_panes}'`); `kill-pane`; **if it was the last pane in the window** (`window_panes == 1`), release that window's iTerm viewer rather than leaving it detached. Reuse `buildITermHideMarkedViewerScript` (`iterm-attach.js:57`, currently unused). Gate the window/viewer teardown on `window_panes == 1` so multi-agent windows (single-window model) keep the shared window/viewer for remaining agents — closing one agent must not nuke the others.

**Why this is also the single-window payoff:** under one session + one window + one owned viewer, "Close" is unambiguous — kill the pane; the shared window/viewer persist; the lingering-window class disappears entirely.

**Test (new, throwaway tmux session):** create a solo-window pane, `kill-pane`, assert the window is gone and the viewer-release path fired; create a 2-pane window, `kill-pane` one, assert the window + viewer survive.

## 3. BUG B — multiple windows on launch

**Findings (confirmed):**
- All 22 agents in `agents.json` have **no `team`** → swarmy maps to `DEFAULT_TEAM` and the `teams` layout **collapses to one window** (`agentremote_runtime.py` teams branch; live `chq` currently shows exactly 1 window). Doc intent agrees (`launch-scripts.md:84-88`).
- No layout is persisted in localStorage → the default (`teams`) applies.
- Therefore multi-window comes from: **(a)** selecting **Tabs/`ittab`** at deploy time — one window *per agent* **by design** (`agentremote_runtime.py` ittab branch); and/or **(b)** **stray tmux windows** (residue from prior deploys / partial collapses) each surfacing as a separate iTerm native window under control mode.

**Remedy (covers all candidate causes; stays within swarmy-canonical for now):**
1. **Single-window is the default and primary operator layout** — deploy puts all selected agents into one tmux session, one window, as tiled panes, surfaced as one marked iTerm viewer.
2. **Intuitive UI** — the multi-window layouts (Tabs/`ittab`) are demoted and explicitly labeled "opens one window per agent," so Richard never gets N windows by accident. Default selection + deploy-overlay copy make the one-window outcome obvious.
3. **No stray windows** — deploy reconciles `chq` to the intended topology (clear residue windows via the existing `tmux-iterm-residue.js` builders) so control mode surfaces exactly one native window.

**Verification (gated on Richard's live-cutover OK):** the boundary diagnostic — deploy 2 agents, then `tmux show-option @chq_layout`, `list-windows`, `list-clients`, `osascript count iTerm windows` — proving exactly one tmux window + one iTerm window.

## 4. Button / IPC audit ("make all the buttons work")

Per the diagnostic, all primary controls map to live handlers. Cleanups:
- **Dead handlers (remove):** `get-pane-sidecar` (`main.js:886`), `agent-pet-state` (`main.js:1247`, superseded by `load-agent-pet-state`), swarmy `status` subcommand (never called from app).
- **Duplicate dual-registered (collapse to one):** `broadcast-message` (`handle` `1657` + `on` `1659`), `spawn-agents` (`handle` `2047` + `on` `2048`) — renderer uses `invoke`; keep the `handle` path.
- **Suspect (verify reachable, fix if not):** Armory Import `list-armory-agents` (can fail silently on missing ACRM env/network — add a clear failure state), empty-state "+ Add agent" inline button (`index.html:5095` — confirm click is wired), `read-clipboard-text`, `atlas:get-event-log`.
- **BROKEN:** radial Close (`kill-pane`) — fixed in §2.

## 5. Architecture — `main.js` IPC backend decomposition

`main.js` is 3,638 lines. Build on already-extracted modules (`tmux-send-path.js`, `pane-stream-filter.js`, `agent-transcript-source.js`, `deploy-viewer.js`, `iterm-attach.js`, `layout-policy.js`, `tmux-iterm-residue.js`, `pane-resolver.js`, …). Extract, in order of bug-relevance:
- `pane-control.js` — `kill-pane` (+ §2 fix), `attach-pane`, `restart-agent`, bg-pid reap. **(BUG A lands here.)**
- `iterm-viewer.js` — find/create/release the one marked viewer (consumes `iterm-attach.js`). **(BUG A + BUG B viewer logic.)**
- `tmux-session.js` — kill-session, layout query, has-session, ownership sentinel.
- `pane-pipe.js`, `agent-registry.js`, `pet-windows.js`, `council.js`, `ipc-registry.js` (wires handlers; drops the dead/duplicate channels).
- `tmux-deploy.js` — **scaffold + document only this session** (the future swarmy-free in-app deploy path). Not cut over.

Each unit: one responsibility, a small public interface, unit-testable in isolation. No renderer decomposition this session.

## 6. Docs to update
- `docs/operations/agentremote-operator-contract.md` — Pane/Layout + Runtime Ownership sections: single-window is the default operator layout; "Close" fully releases the viewer for an emptied window; record that an in-app runtime (swarmy-optional) is the documented future direction.
- `docs/operations/launch-scripts.md` — layout vocabulary + the one-window default.
- `memory/tasks/tasks.json` — add rows for BUG A, BUG B, the audit, and the decomposition; close on verification.

## 7. Contract change (greenlit by Richard 2026-06-19)
Today the contract makes **swarmy authoritative** for spawn and lists multi-window layouts as intended defaults. Richard greenlit changing this:
- **(a) Native spawn.** AgentRemote spawns agents itself via an in-app `tmux-deploy.js`; the swarmy python runtime leaves the spawn path. Swarmy is kept only as a hidden `AGENTREMOTE_SPAWN=swarmy` fallback during transition, default native.
- **(b) Single window, one model.** The 3 layout pills collapse to the single-window model (Richard: they "do the same thing"). All selected agents land as tiled panes in one tmux window.
- **(c) Clean close.** "Close" releases the viewer of an emptied window.

The operator contract's Runtime Ownership + Pane/Layout sections are rewritten to match. Embedded-terminal (replacing iTerm control-mode) remains the documented next increment.

## 8. Testing & verification gates
- Static/unit tests run via Node's built-in runner (`cd remote-app && node --test test/<file>.test.js`); full suite `npm test`.
- New tests: `pane-control` kill-path (BUG A) and a deploy **topology** test (BUG B: deploy N fake agents → exactly one window) — both against **isolated throwaway tmux sessions**, never the live `chq`.
- **No live PASS from static tests alone.** Live cutover to Richard's daily HUD (relaunch + the boundary diagnostic) happens only with his explicit OK.

## 9. Deliverables back to Richard at session end
1. "Repo is updated / code in order" signal.
2. A ready-to-paste kickoff **prompt for the future PM/public-extraction session** (naming, packaging, license, repo carve-out, swarmy-free runtime, pet-creation feature).
