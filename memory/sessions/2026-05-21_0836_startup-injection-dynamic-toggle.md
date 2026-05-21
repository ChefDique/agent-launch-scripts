# Startup Injection Dynamic Toggle — 2026-05-21 08:36

## Outcome
Rebuilt the agent startup sequence (dismiss the dev/permission warning, then inject the startup command) as a runtime-agnostic per-agent toggle in `launch-agent.sh`, and fixed the injected-command submit with the same two-phase fix as the AgentRemote send path. Also corrected a factual error: the live fleet is Claude (Opus 4.7), not Codex.

## Work
- **Made startup injection runtime-agnostic.** `startup_injection_allows()` and the boot block were hard-gated to `RUNTIME == "claude"`; now the per-agent `startup_injection` policy is the toggle and any runtime can opt in. An agent with no policy still gets nothing injected (preserves the no-stray-Enter safety the old gate gave).
- **Fixed the injected-command fuse bug.** `send_tmux_literal_line` fired literal text then Enter back-to-back (same root cause as LRN-20260521-001), so `/lead-gogo` could land in the composer unsubmitted. Now two-phase (text, `STARTUP_SUBMIT_ENTER_DELAY`, Enter). Benefits the live Claude fleet immediately. Runs on every auto-restart (the Swarmy wrapper re-execs `launch-agent.sh`).
- **Configurable warning-ack** ("1 or enter"): `schedule_warning_ack` sends `startup_injection.warning_ack_keys` (default `["Enter"]`, e.g. `["1","Enter"]`).
- **Guards:** Claude-only `/color`+`/rename` are never injected into non-Claude panes; the startup command goes via injection OR argv, never both (no duplicate `/lead-gogo`).
- **Corrected the runtime fact.** Earlier I told Richard the fleet was Codex (misread `pane_current_command=2.1.143`). Confirmed via the `@agent-runtime` pane tag + the Claude statusline that all panes are `runtime=claude`. So the on-disk `agents.json` (claude/opus-4-7) matches the running fleet — it does not contradict it.
- **Verified auto-restart is already live**: panes carry `remain-on-exit on` + a `pane-died` respawn hook (Swarmy-set).

## Artifacts
- Commit `4d32e90` (launch-agent.sh + test/launch-agent-runtime.test.sh + spec REQ-B4 + reference).
- Isolated test: `test/launch-agent-runtime.test.sh` (codex-policy now expects injection; new warning-keys case; TMUX_PANE unset in base env). Passes; 145 node tests still pass.
- Auto-memory: `feedback_hud_relaunch_not_disruptive.md` (reset/relaunch the HUD at will).

## Followups
- **AgentRemote `applyRuntimePolicy` strips `startup_injection` from non-Claude agents on add/edit** (main.js lines ~735, ~2298). Lift that strip if Richard wants to manage a Codex agent's injection from the HUD; for now set it in `agents.json` directly. Not needed for the current Claude fleet.
- `agents.json` still uncommitted (gitignored, machine-local) — matches the live Claude fleet; commit only on Richard's call.
- ALS-LOCAL-001 image paste: dedicated live paste check still owed.
- Nothing pushed; push on Richard's request.
