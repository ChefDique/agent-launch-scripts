# Session 2026-05-21 10:09 — startup-injection wired to Claude fleet + iTerm broadcast root cause

## Outcome
Fixed "never gets past the dangerous warning automatically": wired `startup_injection` (include `dangerous_permission_enter` + `startup_lines`) onto all 7 Claude fleet agents, so each auto-dismisses the dev-channels warning and runs its startup command on every launch/restart. Separately diagnosed Richard's "Shift+Return hits all panes / extra carriage returns" as iTerm2 **Broadcast Input**, not tmux or the scripts.

## Work
- Root cause of the warning hang: **no** Claude agent had `dangerous_permission_enter` enabled; xavier + hansel explicitly set `exclude: ["dangerous_permission_enter"]`. The launcher mechanism (built/tested in commit `4d32e90`) was correct but unwired.
- Empirically verified in isolated throwaway tmux sessions (claude v2.1.146): the blocking screen is the `--dangerously-load-development-channels` warning (default option = safe "I am using this for local development", "Enter to confirm"); a single `tmux send-keys Enter` dismisses it straight to the prompt; there is **no** separate `--dangerously-skip-permissions` accept screen in this version; warning renders by ~2.5s vs the 4s `CLAUDE_WARNING_ACK_DELAY` (safe margin). So the launcher default `["Enter"]` ack is correct — no `warning_ack_keys` override needed.
- Edited 7 Claude agents in `agents.json`: mugatu/08_creative/neo/zoolander/lucius (legacy fallback → /color + /rename + /lead-gogo); xavier (startup_lines now `["/color yellow","/lead-gogo"]`, removed exclude); hansel (kept `["/color pink"]`, removed exclude, startup_slash still empty). No non-Claude agent given the policy.
- Validated: `jq empty` OK, per-agent policy table confirmed, `bash -n` OK, `test/launch-agent-runtime.test.sh` passed.
- iTerm broadcast diagnosis: live `chq:1` window = 6 agent panes in ONE window, surfaced via `tmux -CC` control mode. tmux `synchronize-panes` OFF on every window; no repo code broadcasts keyboard input. ⇒ cause is iTerm Shell → Broadcast Input (toggle ⌘⌥I). Fix = set to "Broadcast Input to None". Launcher injection unaffected (targets one pane via `tmux send-keys -t <pane>`).
- Corrected handoff error: `agents.json` is **tracked**, not gitignored. Committed the wiring locally (not pushed).

## Artifacts
- Commit `38f5ff2` — fix(launch): wire Claude fleet startup_injection so warning auto-acks + startup runs (agents.json).
- Memory: `memory/project_iterm_broadcast_extra_cr.md` (+ MEMORY.md index line).

## Followups
- Push `38f5ff2` to origin when Richard asks (project rule: push only on request).
- Live end-to-end via `launch-agent.sh` was deliberately skipped (would load telegram plugin → 409 risk on live bot); every link verified independently instead. Optional belt-and-suspenders if a fresh restart is observed misbehaving.
- Still open: `applyRuntimePolicy` (`remote-app/main.js` ~735/~2298) strips `startup_injection` from non-Claude on UI-edit — lift only if HUD-managed Codex injection is wanted.
