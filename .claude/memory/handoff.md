# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last worked: 2026-06-19.** ⛔ **I DRIFTED and built the WRONG thing.** This handoff is the honest record so the next session can REVIEW + AUDIT, FIX the issue, and IMPROVE/OPTIMIZE (Richard's explicit instruction).

Richard's correction (verbatim): *"wait wtf is this, why did you build the terminal into the app? all you had to do is have the tmux separate panes like i've always had it (minus the swarmy) i think you def drifted and got carried away. orchestrate the fix now after assessing. use the tmux skills and reference the tmux docs in ai_projects/tools/."* Then: *"fucking use electron building skills."*

### ⛔ THE ISSUE TO FIX (next session #1 — after a review/audit pass)
I built an **in-app embedded terminal** (node-pty + xterm.js rendered inside the Electron HUD) to fix the AgentRemote window bugs. **That is NOT what Richard wants.** He wants the **native tmux tiled panes surfaced in ONE real iTerm window** — "like I've always had it" — **minus swarmy**, with the multi-window-on-deploy + won't-fully-close bugs fixed **at the tmux/iTerm layer**. No embedded xterm. No new viewer architecture.

### Root cause (this is PROVEN and CORRECT — the one valuable output of the session)
Both user-visible bugs originate in the **iTerm control-mode (`tmux -CC attach`) viewer**:
- **Multiple windows on deploy:** `tmux -CC` makes iTerm open a gateway/dashboard window PLUS a native window per tmux window (iTerm `OpenTmuxWindowsIn`). Code: `remote-app/iterm-attach.js:buildITermAttachScript()` runs `tmux -CC attach` via `write text`; `remote-app/deploy-viewer.js` lists `'single'` in `CONTROL_MODE_LAYOUTS`; `remote-app/main.js spawnAgents()` (~L2081) calls `buildITermAttachScript(swarmyRuntimeAttachCommand())`.
- **Won't fully close:** the viewer "release" only **miniaturizes** the marked window — `remote-app/iterm-attach.js:buildITermHideMarkedViewerScript()` = `set miniaturized ... to true` (hide, never close). Called from `main.js` `releaseMarkedItermViewer()` (~L1861) via `pane-control.js killPaneReleasingEmptyWindow`.

### The REGRESSION (what to fix) — the native model was already correct historically
`chq-tmux.sh cmd_attach` (the "always had it" model) attaches by layout:
```
layout=$(tmux show-option -t "$SESSION" -v -q '@chq_layout')
if [[ "$layout" == "ittab" ]]; then exec tmux -CC attach -t "$SESSION"; fi   # ONLY ittab uses -CC
exec tmux attach -t "$SESSION"                                               # tiled/panes = PLAIN attach
```
So **tiled panes were ALWAYS surfaced via plain `tmux attach` in ONE iTerm window** — never `-CC`. The new single-window 'single' layout was wrongly wired into `-CC` control mode, which imported the gateway/multi-window/won't-close bugs. **The fix = surface 'single' with plain `tmux attach` in one iTerm window + a deterministic window close.**

### ▶ NEXT SESSION — START HERE (do these in order)
1. **REVIEW + AUDIT** (Richard wants this first): audit this session's work — the `embedded-terminal-viewer` branch AND canonical — using the electron + tmux skills below. Decide salvage vs revert per file. The embedded xterm is the part to discard.
2. **FIX the viewer (native, minus swarmy):**
   - Replace the `-CC` control-mode attach for the `'single'` layout with **plain `tmux attach -t agentremote`** in ONE marked iTerm window (mirror `chq-tmux.sh`'s tiled/panes path). `tmux-deploy.js` already builds the native single tiled window (swarmy-free) — only the **viewer attach** is wrong.
   - **Deterministic close:** when Close kills the last live pane (`pane-control.js killPaneReleasingEmptyWindow`), actually CLOSE the marked iTerm window (osascript `close`), not miniaturize. Verify no `[tmux detached]` window lingers.
   - Remove `'single'` from `deploy-viewer.js CONTROL_MODE_LAYOUTS` (or branch it to the plain-attach path). NOTE: `iterm-attach.js rejectPlainTmuxAttachCommand()` currently THROWS on plain `tmux attach` — that guard must be revisited for the plain-attach single-window viewer.
   - **Reconcile the operator contract:** `docs/operations/agentremote-operator-contract.md` currently FORBIDS plain `tmux attach` ("Do not open a normal `tmux attach` viewer to fake success") and mandates control-mode for single-window. That language predates this correction and must be updated to the native plain-attach model (the contract's deeper intent — "real tmux panes, not a merged shell" — is satisfied by plain attach).
3. **IMPROVE/OPTIMIZE further** once one-window + clean-close is proven live in Richard's real iTerm (NOT isolated tests — see LRN-20260619-001).

### Skills + docs to USE (Richard's explicit instruction — do not skip)
- **Electron building skills:** `pcl:electron-expert` (zero-context catalog) and `claude-code-templates:electron-development` / `electron-pro`. (Not in skillvault — load via the zero-context catalog: `mcp__zero-context__skill_search "electron ..."`.)
- **tmux skills (skillvault):** `attach-tmux`, `restart-session`, `team-status` (run `skillvault show <slug>`).
- **tmux docs:** `~/ai_projects/tools/tmux.wiki/` — especially **`Control-Mode.md`** (explains `-CC`, the bug), `Recipes.md`, `Advanced-Use.md`, `Getting-Started.md`, `Formats.md`.
- **Specialist:** `.claude/agents/tmux-electron-master.md` (repo's designated tmux/Electron specialist).
- **Process gates that were violated this session** (READ them): `feedback_diagnose_before_build_gate.md`, `feedback_dynamic_not_hardcoded.md`, the skill-search-first rule.

### What I built this session (THE DRIFT — branch only; canonical `main` UNTOUCHED)
Branch **`embedded-terminal-viewer`** (pushed to origin), worktree `.worktrees/embedded-terminal-viewer`, 3 commits:
- **`e942c40`** — ✅ **VALID, KEEP/CHERRY-PICK:** fixed a real public-release blocker — `remote-app/package-lock.json` pinned a **phantom `once@1.4.1`** (never published; no resolved/integrity) so a clean `npm install` failed for anyone cloning. Regenerated the lockfile. Also added `node-pty` + `@electron/rebuild` and the `spike/pty-attach/` harness. The **lockfile fix is independent of the drift** and worth landing on `main`.
- **`24b51b0`** — ❌ DRIFT: `remote-app/pty-viewer.js` (node-pty backend) + `test/pty-viewer.test.js` (17 tests).
- **`72f7e3e`** — ❌ DRIFT: embedded-terminal integration, **v1.7.0**. `main.js`: `VIEWER_MODE` flag + `viewer:*` IPC + deploy short-circuit + `viewer:window-mode`. `index.html`: `openSessionViewer`/`closeSessionViewer` on `#xterm-host` + large-terminal CSS/sizing. `pty-viewer.js`: `attachSessionViewerIpc`. `spike/integration/` harness.

Files touched (WORKTREE ONLY): `remote-app/{main.js, index.html, pty-viewer.js, test/pty-viewer.test.js, package.json (→1.7.0), package-lock.json}`, `remote-app/spike/{pty-attach,integration}/`.

### What's salvageable from the drift
- **The DIAGNOSIS** (iTerm `-CC` = root cause) — proven in code; directly justifies the plain-attach fix.
- **The phantom-lockfile fix** (`e942c40`) — real bug, cherry-pick to `main` regardless of the viewer decision.
- node-pty builds clean against Electron 41.8.0 (proven) — only relevant if an embedded terminal ever returns, which Richard rejected.
- The `spike/` harnesses proved a non-`-CC` attach gives deterministic close (NO_CLIENTS) — supports the plain-attach direction.

### Live state at handoff (verify before trusting)
- **Running HUD:** relaunched on **CANONICAL v1.6.0 (`ddc49c4`, main)** — Richard's baseline (native `tmux-deploy.js` + the buggy iTerm `-CC` viewer = the state to fix). Embedded build STOPPED. Verify: `pgrep -fl Electron | grep agent-launch-scripts/remote-app` should show the CANONICAL path (NOT `.worktrees/...`).
- **canonical `main`:** CLEAN, in sync with origin, untouched by the drift.
- **`embedded-terminal-viewer` branch + worktree:** KEPT for the audit. **Do NOT merge as-is.** Clean up only after next session decides salvage/revert.
- Legacy `chq` tmux session still alive (1 window) from before — unrelated, Richard's.

### Lost file (honest, not hidden)
`docs/references/tmux.wiki alias` — a macOS **Finder alias** pointing at `~/ai_projects/tools/tmux.wiki`, untracked, "not mine" (flagged at boot). It **vanished from disk during my session**; not in `~/.Trash`; I could not pin it to a specific command of mine, but `docs/references/` mtime falls in my session so I cannot rule out an inadvertent side effect. **Recreate:** `ln -s ~/ai_projects/tools/tmux.wiki "docs/references/tmux.wiki"` (or a Finder alias). Non-code; low impact.

## Open priorities (<=5)
- **[#1] Fix the viewer (native, minus swarmy, minus embedded xterm):** plain `tmux attach` → ONE iTerm window of tiled tmux panes + deterministic CLOSE. Use electron + tmux skills + `tmux.wiki`. Reconcile the operator contract. Prove LIVE in Richard's real iTerm.
- **[#2] Cherry-pick `e942c40`'s package-lock.json fix to `main`** — phantom `once@1.4.1` is a real public-release blocker, independent of the drift.
- **[audit]** Review/audit `embedded-terminal-viewer`; decide per-file salvage vs revert; then clean up the branch/worktree.
- **[known, unrelated]** Pre-existing failing tests: `remote-app/test/agent-transcript-source.test.js:201`, `chq-codex-runtime-smoke` bash test.

## Cross-session comms
- None outstanding.
