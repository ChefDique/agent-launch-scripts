# Handoff — TMUX-MASTA

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote reliability/versioning closeout after stale worktree app confusion: floating pets shipped, stale worktree launcher bug fixed, session-end cleanup hook added, and build identity/version discipline added.

**State at handoff capture (2026-05-06T11:04:00-0700):**
- Main checkout is `/Users/richardadair/agent-launch-scripts` on `main`; it was clean before the final version-badge commit, with local commits ahead of `origin/main`.
- Shipped commits already on `main`: `76b13f1` floating pet windows, `940afd2` pet polish, `5bed011` app-generated registry/avatar updates, `df691c5` stale worktree launch fix, `6377c64` Codex visibility state, and `5598ba6` AgentRemote session cleanup hook.
- Critical incident root cause: Richard reloaded an AgentRemote process that was actually running from `/Users/richardadair/.codex/worktrees/8e7d/agent-launch-scripts/remote-app` on branch `codex/tmux-gogo-launch-fixes`, not the canonical main checkout. `launch-remote.sh` now kills main/worktree AgentRemote Electron instances before launching canonical main.
- New session-end contract: run `bash scripts/session-end-cleanup.sh` after any session that launched/restarted/tested AgentRemote unless Richard explicitly asks to keep it running. The hook stops stale AgentRemote apps across main/worktrees, clears Chromium caches, preserves `Local Storage/` and `pet-state.json`, prints git status/worktrees/processes, and must be cited in final status if anything remains.
- Dirty tree policy is now in `AGENTS.md`, `CLAUDE.md`, and `remote-app/AGENTS.md`: dirty files are shared operational evidence. Classify app-generated registry/avatar state or other-lane state every time; do not dismiss it as unrelated mystery user work.
- Versioning work in progress at capture: `remote-app/package.json` and lockfile bumped `1.0.0 -> 1.0.1`; `main.js` adds `app-build-info`; `index.html` shows subtle bottom-corner `v<semver> <branch>@<sha>` badge with branch/commit/dirty/path tooltip; repo-local `.claude/skills/gogo/SKILL.md` now checks package version and live Electron process path.
- Versioning rules added: AgentRemote app work must bump SemVer before commit (patch for fixes/UX affordances, minor for new user-facing capability, major for breaking runtime/registry contracts). `/gogo` must report package version and live checkout path and treat stale `.codex/worktrees/...` apps as blockers unless intentionally kept.
- Verification passed before handoff commit: `cd remote-app && npm test`, `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh scripts/session-end-cleanup.sh`, `node --check remote-app/main.js`, and `git diff --check`.

**Next verifiable step for fresh session:** Confirm the final version-badge commit is present and pushed, then start AgentRemote from canonical main with `bash launch-remote.sh` and visually confirm the bottom-right HUD badge shows `v1.0.1 main@<sha>` and not a `.codex/worktrees` branch/path in the tooltip.

**If that step fails:** Check the live process path with `ps -axo pid,ppid,lstart,command | rg "agent-launch-scripts/remote-app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron|--app-path=.*agent-launch-scripts/remote-app"`, run `bash scripts/session-end-cleanup.sh`, then relaunch with `bash launch-remote.sh`. Check `remote-app/out.log` for renderer errors.

**Pending uncommitted diff at capture:** version-badge files plus this handoff were being committed/pushed as the final closeout. If a fresh session sees any dirty state, review it first and classify it; do not ignore it.

---

## Last working on

ALS-010 attach consolidation merged. The Attach orb is now layout-aware (silent break-pane if the agent shares a window with siblings) and the two settings-popover detach buttons are gone. AgentRemote's HUD architecture refactor (waves 1+2 + visual polish + attach consolidation) is functionally complete on main; Richard has not done end-to-end testing yet.

## Open priorities

- [DEFER] ALS-008 — per-project orchestrator (launchd plist filtered to project=agent-launch-scripts). Bumped to high by Xavier; durable fix for the dispatch friction this session (cherry-pick rescue + one worker bypassing PR path). Pick up next session.
- [PENDING-RICHARD] Telegram bot for TMUX-MASTA channel returns 401 from `getMe`. Token in `~/.claude/channels/telegram-tmux-masta/.env` is revoked or wrong. Needs reissue via @BotFather + replace token before Telegram pings work; until then status updates land in Claude Code.
- [DEFER] ALS-001/002/003 — pre-session tickets still in `dispatch_pending`; waiting on ALS-008 to unblock auto-claim. CHQ orchestrator is project-scoped to CorporateHQ.
- [DEFER] Atlas-of-Atlas-Island migration — AgentRemote product evolution moves to Atlas post-session per Xavier 2026-05-03; TMUX-MASTA retains the tmux script management lane (chq-tmux.sh, launch-agent.sh, agents.json).
- [DEFER] Cron-monitor popup, tmux command palette, layout-preset selector — Atlas-lane backlog per CLAUDE.md.

## Cross-session comms

- 2026-05-04 Xavier: filed OPS-104 (`--add-artifact` FK constraint on cross-project tasks) + OPS-105 (`--check-criterion --evidence` Phase G SyntaxError JSONB sync); bumped ALS-008 to high; per 2026-05-03 rule each lead owns their queue end-to-end.
- 2026-05-04 Richard: skip rollback; collapse 3 detach controls into one layout-aware Attach (shipped as ALS-010); reminded about the auto-restart wrapper preserving across break-pane (verified live — pane_pid stable).
- 2026-05-03 Xavier: AgentRemote product evolution moves to Atlas post-session; TMUX-MASTA keeps the tmux script lane.

## Session log

- 2026-05-05-SESSION: R&D QMD/graphify repo-structure retrieval, agent-first docs reorg, and Codex `hatch-pet` integration path identified for AgentRemote — commits: `72c4703` docs reorg plus `/done` handoff commit — gated on Richard: none
- 2026-05-05-SESSION_2: AgentRemote instructions aligned, Openclaw pet experiment completed, then MVP premade pet roster (`goku`, `nimbus`, `gaara`, `codeberg`, `neo`) bundled as companion chrome — commits: `768fc9d`, `855fa29`, `5d4226b` — gated on Richard: none
- 2026-05-05-SESSION_3: AgentRemote tmux pane management baseline fixed: `MULTI` now preserves draggable `ittab`, split sessions can normalize to per-window panes, and kill/restart/attach/broadcast/xterm now resolve panes through shared sidecar-first identity — commits: `d46016d`, `29e4761` — gated on Richard: verify right-click kill on live `%44`
- 2026-05-05-SESSION_4: Codex-first runtime support and durable docs handoff: `launch-agent.sh` now dispatches Codex/Claude/Hermes/OpenClaw by registry runtime, all local fleet entries default to Codex, ACRM `ALS-011` is `review_pending`, and `context.md` records the Codex-first/ACRM operating contract — commits: `c18f5a4`, `bfd8d95`, `6de1a43` — gated on Richard: none
- 2026-05-05-SESSION_5: Global Codex config cleanup disabled Claude-origin plugins and configured the supported Codex TUI status line equivalent; repo change is handoff-only — commits: `/done` handoff commit — gated on Richard: none
- 2026-05-05-SESSION_6: `/done` and `/chores` local skills pinned explicitly in Codex config after slash-command exposure confusion; repo change is handoff-only — commits: `/done` handoff commit — gated on Richard: none
- 2026-05-06-SESSION: AgentRemote harness/avatar/settings/Armory/pet HUD polish shipped and pushed; next thread scoped to floating undockable pet windows with streaming/reply-capable chat bubbles while preserving HUD free-move behavior — commits: `fbf20e1` pushed plus `/done` handoff commit — gated on Richard: none
- 2026-05-06-SESSION_2: TMUX-MASTA non-pet fixes shipped in a worktree: generic `/gogo` restored/pinned, AgentRemote Deploy simplified to one movable tmux/iTerm window per agent, send ordering fixed, ID edits allowed for stopped agents, and launch scripts made worktree-local — commits: `2624436` plus `/done` handoff commit — gated on Richard: decide landing path for `codex/tmux-gogo-launch-fixes`

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-agent-launch-scripts/memory/MEMORY.md -->
