# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Richard surfaced 4 recurring AgentRemote/launcher complaints in one 2026-05-23 session and hit a breaking point ("I quit") over fixes that hardcode per-agent and don't survive sessions. Opus-Neo. Standing contract now: dynamic-not-hardcoded, root-cause durably, use the `tmux-electron-master` specialist — see [[feedback-dynamic-not-hardcoded]].

**State at last pause (2026-05-23):**
1. **Launcher startup injection — FIXED + COMMITTED (`e124898`), tests green, NOT pushed.** `startup_lines` (/color+/rename+startup_slash) now defaults ON for ALL Claude agents via `startup_injection_active()` — no per-agent `startup_injection.include` needed (the dasha bug). Also fixed: `read_startup_lines` returned 1 on empty `startup_slash` → `set -e` ABORTED the launch before exec, so hansel (empty startup_slash) failed to launch at all — now `return 0`; and Claude null/empty `startup_slash` defaults to `/lead-gogo`. Opt out via `startup_injection.exclude`; non-Claude untouched. Green: launch-agent contract + remote-app 145. Live relaunch of dasha/hansel = approval-gated, not done.
2. **Codex pane keyboard shortcuts (Option+Delete word-delete) — ROOT-CAUSED; fix is Richard's GUI change.** Not tmux: iTerm profiles have Option Key = Normal. Richard: iTerm → Settings → Profiles → Default → Keys → Left/Right Option Key → **Esc+**. [[reference-codex-keys-iterm-fix]]. Optional code hardening (re-apply tmux binds on Attach) = task #4.
3. **HUD per-agent inputs don't persist + color never matches — ROOT-CAUSED (auditor); fix pending Richard's design call.** Two color controls write two fields: the settings-panel Color (text input) writes `color` (the Claude `/color` name, used only at next launch); the HUD tile/orb renders ONLY from `theme_color` (set by the Add-form hex picker). So editing the panel Color changes nothing visible — "never matches." Plus a commit gap: settings inputs save on blur/Enter only, and a window-blur teardown can drop an uncommitted edit. Fix: unify panel Color on `theme_color` + re-render after save + flush-on-teardown. DECISION owed: keep the separate Claude `/color` name field or drop/auto-derive it? Task #7 (HUD work needs version bump + 145 green).
4. **Stale-session / Telegram-poller / MCP cleanup hooks — QUEUED (task #6, NOT started).** Old SessionStart/End cleanup gone; a new session can't use MCP tools held by the prior agent; sessions don't fully shut down. MUST be precise/deterministic — NEVER kill the current session or Richard's running apps/HUD ([[feedback_dont_close_richards_running_apps]]).

**Next verifiable step:** get Richard's design call on the HUD Color field (keep/drop the `/color` name), then implement the HUD persist+color fix (task #7) per the auditor (index.html settings panel ~5996–6334; main.js `UPDATABLE_FIELDS` ~2261–2282; dock render index.html:4900–4902). Then task #6 (stale-session cleanup, precise).

**If that step fails:** the launcher fix is independently committed + green; not at risk.

**Pending uncommitted diff:** `agents.json` (M) — registry reorder (lucius moved below vegeta; vegeta cwd → pod root) from another lane/app, NOT mine. Left for Richard.

## Open priorities (<=5)

- [PRIMARY] **HUD inputs persist + color match** (task #7) — root cause found (color vs theme_color split + commit-event gap); implement after Richard's design call.
- [QUEUED] **Stale-session/Telegram/MCP cleanup hooks** (task #6) — precise deterministic kill of prior-session leftovers ONLY.
- [RICHARD-ACTION] **Codex keys** — iTerm Default profile Option Key → Esc+. [[reference-codex-keys-iterm-fix]]
- [OPTIONAL] **Codex keybind durability** (task #4) — move tmux binds to a sourced conf loaded on Attach too.
- [APPROVAL-GATED] **Live-relaunch dasha/hansel** to confirm the launcher fix on the real desktop.

Paused/superseded (resume after the 4 above): AgentRemote public-release prep [[project_agentremote_public_release]]; Shift+Enter cross-pane CR [[project_iterm_broadcast_extra_cr]].

## Cross-session comms

- None outstanding.
