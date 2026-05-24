# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** 2026-05-23 session. Richard surfaced 4 recurring AgentRemote/launcher complaints and hit a breaking point (personal crisis — eviction — by session end; asked to /done). Two fixes landed + pushed; two root-caused. Opus-Neo. Standing contract: dynamic-not-hardcoded, root-cause durably, use the `tmux-electron-master` specialist, and — NEW — QMD-search prior fixes + read the recovery list BEFORE acting, and COMMIT every fix. See [[feedback-dynamic-not-hardcoded]].

**State at last pause (2026-05-23):**
1. **Launcher dynamic startup injection — DONE, committed `e124898`, PUSHED.** All Claude agents default-on (fixed dasha). Also fixed `read_startup_lines` returning 1 on empty `startup_slash` (this CRASHED hansel's launch before exec under `set -e`) + Claude null/empty `startup_slash` now defaults to `/lead-gogo`. launch-agent contract + remote-app 146 green.
2. **HUD color + input persistence — DONE, committed `44ff2f3`, PUSHED, HUD relaunched LIVE on v1.4.17.** The settings-panel Color wrote `color` (the Claude /color name) while the tile renders from `theme_color` — so it "never matched." Now the panel Color is a hex picker writing `theme_color` with live repaint + a flush-on-teardown for the blur/Enter commit gap. 146 tests pass.
3. **Codex keyboard (Option+Delete word-delete) — ROOT-CAUSED; Richard's GUI fix, NOT mine to do.** iTerm Default profile Left/Right Option Key is set to Normal and must be **Esc+**. That's the whole fix (and why it "worked then stopped"). [[reference-codex-keys-iterm-fix]]. Optional code hardening (re-apply tmux binds on Attach) = task #4, cross-repo (swarmy).
4. **Stale-session / Telegram / MCP cleanup (#6) — PARTIALLY already solved.** The Telegram-poller killer fix is committed in CorporateHQ (`5bb362e0`, Lucius — `lsof`/`bun server.ts` poller logic). Remaining: stale MCP tools held by a prior session + sessions not fully closing = SessionStart/End hooks in GLOBAL `~/.claude/settings.json` — APPROVAL-GATED (a read got denied; needs Richard's explicit OK; not this repo's lane).

**Déjà-vu root cause (NEW, found via QMD):** Richard relives the same fixes because (a) fixes get made but NOT committed → wiped on the next checkout (the telegram fix literally said "live on disk, not committed"), and (b) the agent skips reading `docs/operations/agentremote-recovery-list.md` + `agentremote-operator-contract.md` before acting. Fix the loop: QMD-search + read the recovery list before any iTerm/tmux/cleanup action; commit every fix.

**Mistake this session:** ran `scripts/session-end-cleanup.sh` just to clear a Chromium cache — it ALSO closes marked iTerm viewer windows (violated the recovery-list "never close operator windows as setup" rule; Richard noticed). tmux sessions/agents all survived; only viewer windows closed. For a cache-only clear, `rm` the specific cache dirs directly — never the closeout script mid-session.

**Next verifiable step:** get Richard's OK to edit global `~/.claude/settings.json` hooks for the stale-MCP/session-shutdown cleanup (#6). His iTerm Option-key change is owed for Codex keys. Then optional codex tmux-conf hardening (#4, coordinate with swarmy).

**Pending uncommitted diff:** `agents.json` (M) — registry reorder from another lane, NOT mine. Left for Richard.

**Also this session (post-handoff):** Reconciled the push rule to lead-push-by-default in CLAUDE.md + AGENTS.md (`324a1e4`, pushed) — it had contradicted the global git-workflow and caused friction. Ran /claude-md-audit (blind zero-context subagent + filesystem verify): all paths resolve, no stale refs, no split needed (111 lines). New durable rule [[feedback-review-after-tasks]]: review/debug after tasks + give subagents task-matched skills.

**Session-end note:** Did NOT kill the session PID — Richard in distress + standing rule never to close his running session/apps ([[feedback_dont_close_richards_running_apps]]). HUD left running (v1.4.17).

## Open priorities (<=5)

- [APPROVAL-GATED] **Stale MCP / session-shutdown cleanup** (#6) — needs Richard's OK to edit global `~/.claude/settings.json` hooks. Telegram-poller half already committed in CorporateHQ.
- [RICHARD-ACTION] **Codex keys** — iTerm Default profile Left/Right Option Key → Esc+. [[reference-codex-keys-iterm-fix]]
- [OPTIONAL] **Codex keybind durability** (#4) — move tmux binds to a sourced conf loaded on Attach too (swarmy lane).
- [APPROVAL-GATED] **Live-relaunch dasha/hansel** to confirm the launcher fix on the real desktop.
- Paused (resume later): AgentRemote public-release prep [[project_agentremote_public_release]]; Shift+Enter cross-pane CR [[project_iterm_broadcast_extra_cr]].

## Cross-session comms

- None outstanding.
