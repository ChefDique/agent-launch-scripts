# Session 2026-05-21 11:46 — startup-warning auto-dismiss (default-on + HUD toggle) + tmux-masta→neo rename

## Outcome
Solved the original problem ("agents never get past the dangerous warning automatically"): the Claude dev-channels warning-ack now **defaults ON** in `launch-agent.sh`, and Richard's missing piece — a **per-agent "Startup auto-run" toggle** in the HUD — shipped in v1.4.16. Also retired the legacy `tmux-masta` identity → `neo` across the repo.

## Work
- **Root cause (via tracer subagent):** the live path already runs `launch-agent.sh` (swarmy's `agentremote_runtime.py:1049` execs it inside the pane), so the warning-ack mechanism worked — but it was **per-agent opt-in**, and `dasha` (flipped to Claude after the original 7-agent wiring) had no policy and hung. The 2026-05-20 "default excludes dangerous_permission_enter" decision was the regression.
- **Fix (`launch-agent.sh`, commit 80128ea):** warning-ack defaults ON for the Claude runtime unless an agent explicitly excludes `dangerous_permission_enter` (Claude always passes `--dangerously-load-development-channels`, so the warning always shows). Non-Claude still requires explicit opt-in (no stray Enter). Updated the launcher test to the new contract + `launch-scripts.md`.
- **The switch (commit 76ebc52, v1.4.16):** per-agent "Startup auto-run" toggle in the gear settings panel (Claude agents), mirroring the auto_restart toggle. ON → `startup_injection {include:[dangerous_permission_enter, startup_lines]}`; OFF → `{exclude:[...]}` (overrides the default-on). Uses the existing `update-agent` PATCH. Aligned `defaultClaudeStartupInjectionPolicy` with the launcher default + updated its guard test.
- **Rename (commit acd7d10):** `tmux-masta` → `neo` in docs/memory/tasks/tests/hook; `agent-notes/tmux-masta.md` → `neo.md`; removed orphan `tmux-masta.svg/gif` avatars. Registry id was already `neo`.
- Verified: remote-app 145/145, launcher tests green, JSON valid, `bash -n` clean.
- Walked back the earlier (wrong) iTerm-Broadcast-Input diagnosis for the cross-pane-CR issue after Richard rejected it.

## Artifacts
- Commits: `80128ea` (default-on fix), `acd7d10` (rename), `76ebc52` (HUD toggle v1.4.16). Earlier this session: `38f5ff2`, `49dff15`, `54ee3de`. None pushed.
- Memory: `project_iterm_broadcast_extra_cr.md` (cause OPEN).

## Followups
- Push the commits when Richard asks.
- Visually confirm the v1.4.16 "Startup auto-run" toggle renders (HUD relaunch) — tests pass but live render not yet eyeballed.
- `applyRuntimePolicy` still strips `startup_injection` from non-Claude on UI edit; only matters if HUD-managed Codex injection is ever wanted.
- **METHOD (most important):** Richard set "first of all what problem are you trying to solve" as a *diagnose-before-build* gate; I built first, repeatedly. See agent-notes.
