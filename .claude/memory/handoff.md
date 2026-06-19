# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** 2026-06-19. Large AgentRemote reliability + public-readiness push. ALL CODE MERGED TO `main` (`4b4384f`, pushed; worktree+branch cleaned). HUD relaunched on the new build (v1.6.0, PID 43554, canonical path).

### ⛔ READ THIS FIRST — the user's ACTUAL bugs are NOT fixed
Richard, 2026-06-19 live eyeball: **"the same issues I mentioned at the beginning are still present — starting the agents up, and shutting them down."** Both **BUG B (multiple windows on deploy)** and **BUG A (Close doesn't fully close)** STILL HAPPEN in his real usage.

- **Root cause (missed all session):** the bugs live in the **iTerm control-mode (`tmux -CC attach`) layer, NOT the tmux topology.** iTerm `-CC` opens a GATEWAY/dashboard window ("AgentRemote Viewer") **plus** a window/tab per tmux window (`OpenTmuxWindowsIn=1`). Collapsing the *tmux* side to one window (which I did + verified) does NOT remove iTerm's gateway/extra windows, and the osascript viewer-release doesn't reliably close them.
- **I over-claimed "both bugs fixed"** — I verified tmux topology + isolated throwaway-session tests, NOT Richard's real iTerm UX. The operator contract's Proof-Before-PASS requires proving the **iTerm/viewer materialization**; only tmux was proven. See `.learnings/LEARNINGS.md` LRN-20260619-001.

### ▶ NEXT SESSION — START HERE (the real fix)
1. **Build the in-app EMBEDDED TERMINAL** to replace iTerm control-mode entirely (was wrongly deferred — it is THE fix for BOTH user-visible bugs). One AgentRemote app window, agents in an embedded xterm; no `tmux -CC`, no gateway window, deterministic close. The core ask ("one terminal window" + clean shutdown) is NOT met until this lands.
   - Quick alt to spike FIRST if cheap: iTerm `OpenTmuxWindowsIn=2` (tabs-in-attaching-window) + hide the gateway — *might* yield one-window with current arch, but iTerm-config-dependent + won't fully fix Close. Embedded terminal is the robust answer.
2. Then PM/public-release work — prompt at `docs/exec-plans/active/next-session-public-release-prompt.md`.

### What LANDED this session (merged; correct at the tmux/app layer, but insufficient for the UX bugs)
- **Native single-window tmux spawn** (`remote-app/tmux-deploy.js`) replacing swarmy python on the default spawn path (swarmy → `AGENTREMOTE_SPAWN=swarmy` fallback). Session name **`chq`→`agentremote`** (configurable `AGENTREMOTE_TMUX_SESSION`); iTerm title → "AgentRemote Viewer".
- **Independent code-review caught + fixed a BLOCKER + 5 HIGH + 2 MED** the green tests had missed: auto-restart `pane-died` hook was silently dead (tmux rejected unquoted run-shell) → now installs + respawns (proven). H1 re-deploy dup, H2 instant-exit ghost, H3 dead-pane defeats viewer gate, H4 cross-runtime identity dup, H5 swarmy `--layout single` rejected. All RED-proven tests.
- `pane-control.js` kill-pane viewer-release, layout-pill UI collapse, button/IPC cleanup (dead handlers, dup registrations, Armory hang). Docs/contract/AGENTS/CLAUDE/launch-scripts/spec updated; board logged.
- Suite 188/187 (1 pre-existing), integration 10/10 (real throwaway tmux), isolated live restart+close proof.

### Live state at handoff
HUD on new build (v1.6.0 main@4b4384f). Test `agentremote` session torn down (gone). Original `chq` session still alive (1 window). **Migration:** new default session = `agentremote`; old `chq` orphaned on relaunch — clean/migrate when convenient.

**Pending uncommitted:** `agents.json` (HUD registry edit from the live deploy test) — committed this closeout. `docs/references/tmux.wiki alias` (??) not mine.

## Open priorities (<=5)
- **[#1 — THE CORE ASK, UNSOLVED]** Embedded terminal → true one-window + clean Close (replaces iTerm control-mode). Both user bugs persist until this lands.
- [PM session] Public-release: naming/packaging/license/de-Richard-ify (prompt committed).
- [deferred] Finish swarmy removal: native attach/stop (M2) + `@chq_layout` internal rename (currently bridged via `@swarmy_runtime`).
- [known, unrelated] Pre-existing failures: `agent-transcript-source.test.js:201`, `chq-codex-runtime-smoke` bash test.

## Cross-session comms
- None outstanding.
