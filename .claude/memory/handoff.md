# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last worked: 2026-06-19.** The embedded-terminal drift is DEAD. The native fix
shipped: **BUG B (Deploy opens multiple iTerm windows) is FIXED via plain
`tmux attach` and PROVEN live.** On `main` @ `2fbb2ec`, **v1.6.2**, HUD relaunched
from the canonical checkout.

### ⚠️ SAFETY — read before any tmux kill
The Neo operator session may be running **inside** the `agentremote` tmux session
it manages (on 2026-06-19 it was pane `%1`, the only live pane). Killing that
session/server = killing Neo. "kill the vegeta session" was a near-miss: there
was NO live vegeta/codex process — only the tmux *server's* startup argv named it.
Always `echo "$TMUX_PANE"` + list real panes/processes before any kill. See
memory `reference_neo_may_run_inside_agentremote`.

### What shipped this session (on `main`, pushed)
- **`a150668` (v1.6.1) — BUG B + BUG A:** single-window viewer now uses PLAIN
  `tmux attach -t agentremote` in ONE marked iTerm window (not iTerm `-CC`).
  `deploy-viewer.js`: `'single'` removed from `CONTROL_MODE_LAYOUTS` (any client
  satisfies it). `iterm-attach.js`: `buildITermAttachScript` allows plain attach;
  `buildITermHideMarkedViewerScript`→`buildITermCloseMarkedViewerScript` (close,
  not miniaturize). `main.js`: `plainAttachViewerCommand()` used by the deploy
  attach + release. Attach-pane (single-agent button) deliberately LEFT on the
  old `-CC` path (follow-up).
- **`5b10afa` (v1.6.2) — tooltip:** subtle `.composer-hint` paste hint above the
  chat ("⌘V / Ctrl+V to paste a screenshot") + reusable on-brand `[data-tooltip]`
  hover system (dark glass; never white native tooltips). renderer-static covers it.
- **`2fbb2ec` — registry:** preserved app-generated `auto_restart:false` on 2
  agents (live HUD edit from the session). Reversible.
- Tests: remote-app JS suite **188/189** (the 1 fail is the pre-existing
  `agent-transcript-source.test.js:201`, unrelated).

### PROVEN vs NOT (per LRN-20260619-001 — don't over-claim)
- **PROVEN live** (isolated throwaway tmux + osascript): plain attach → exactly
  ONE new iTerm window, a PLAIN client (`control_mode=0`), no gateway, no
  per-window minis, no `[tmux detached]` ghost.
- **NOT yet proven live:** the full **Deploy button → viewer** flow (didn't run
  it into `agentremote` because Neo lives there); **explicit Close fully closing
  the window**; kill/status of mis-tagged panes.

### ▶ NEXT SESSION — START HERE (in order)
1. **Live-verify the Deploy fix end-to-end** in Richard's real iTerm: relaunch
   HUD, detach the stale `-CC` viewer (iTerm window 13769 tab 2), click Deploy →
   confirm ONE window, panes tile in, no extra windows. (Couldn't do solo: Neo
   is inside `agentremote`.)
2. **BUG A full-close hardening.** iTerm `close` verb is UNRELIABLE here:
   `PromptOnQuit=1`, and `close` no-ops on a window with a running `tmux attach`
   job. Ghost is gone (plain attach), but explicit Close can leave a shell
   window. Options: make the attach `tmux attach -t S; exit` (auto-close on
   session end — but manual Ctrl-b d would also close the window), or
   `tmux detach-client` then close. Needs Richard's UX call + live test.
3. **Kill/status resolution (kenpachi).** `pane-resolver.js paneOwnerMatchesAgent`
   hard-gates out a pane whose `@agent-identity` is wrong ("neo-claude") even when
   the TITLE matches ("KENPACHI") → live agent shows offline + "isn't running" on
   kill. Root = launcher mis-tag (both NEO+KENPACHI panes were tagged neo-claude).
   Loosening the gate risks regressing LRN-20260509-001 (wrong-pane delivery).
   NEED repro + how kenpachi was launched (AgentRemote deploy? chq-tmux? manual?).
   Do NOT change speculatively.
4. **Attach button → plain-attach single window.** `main.js attach-pane` (~L2830)
   still uses `-CC` (`swarmyRuntimeAttachCommand`, `viewerSafetyState('ittab')`)
   + break-pane-into-own-window (old multi-window model). Align to the single
   plain-attach window. Live iTerm test required.
5. **Lockfile public-release blocker.** The whole `electron` devDep subtree in
   `remote-app/package-lock.json` (~70 entries incl `once`, `wrappy`) lacks
   `resolved`/`integrity` → clean `npm ci` fails for cloners. Fix = deliberate
   `npm install` regen + clean-clone `npm ci` verify; then validate the running
   app. (Doesn't affect Richard's current HUD.)
6. **Drift cleanup:** `embedded-terminal-viewer` branch + `.worktrees/embedded-terminal-viewer`
   are SUPERSEDED by the native fix on main — safe to delete (needs `-D`, so
   escalate per git rule, or do at /done).

### Skills + docs that worked (keep using)
- tmux skill `attach-tmux` (skillvault) — confirmed plain-attach-for-one-window +
  the "don't attach into your own session" warning. tmux `Control-Mode.md`
  (`~/ai_projects/tools/tmux.wiki/`) — explains why `-CC` = gateway+multi-window.
- Operator contract + `.learnings/LEARNINGS.md` (LRN-20260619-001/002) + the
  process-gate memories. Live-test via ISOLATED throwaway sessions + osascript
  window/client counting (never mutate `agentremote`).

## Open priorities (<=5)
- **[#1]** Live-verify Deploy end-to-end + BUG A full-close hardening (Richard's eyeball).
- **[#2]** Lockfile regen (public-release blocker).
- **[#3]** Kill/status resolution (kenpachi) — needs repro + launch context.
- **[#4]** Attach button → plain-attach single window.
- **[cleanup]** Delete superseded `embedded-terminal-viewer` branch/worktree.

## Cross-session comms
- None outstanding.
