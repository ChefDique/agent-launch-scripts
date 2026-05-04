# ALS-002 — Infra audit (multipane, telegram, kill-session)

Audited: 2026-05-03. Read-only.

---

## Complaint 1: MULTI layout

### Reproduction

Live session confirms the failure state:

```
tmux list-windows -t chq         → "0: chq"    (one window only)
tmux list-panes -a               → chq:0.0 … chq:0.4   (five split-panes inside it)
tmux show-option -t chq @chq_layout → "tiled"
```

All agents spawned as horizontal splits in a single window. No separate iTerm windows. `@chq_layout` is `tiled`, not `ittab`.

### Root cause

Two bugs in sequence.

**Bug 1 — Renderer sends the wrong layout value.**
`index.html:1891-1895` `effectiveLayout()`:

```
PANES + multi=on  → 'tiled'
WINDOWS + multi=on → 'ittab'
```

`tiled` is still a split-pane layout (all agents in `chq:0`, auto-balanced grid). It is NOT the "separate iTerm windows" layout. The user must select the **WINDOWS pill** AND turn MULTI on to get `ittab`. PANES+MULTI only produces a tiled grid. The pill labels alone don't make this obvious — selecting MULTI while PANES is active sends `tiled` to `chq-tmux.sh`, which creates the exact cramped-grid that Richard is seeing.

**Bug 2 — `spawn-agents` fallback clobbers valid layouts to `'panes'`.**
`main.js:574`:

```js
const layout = ['panes', 'windows', 'ittab', 'tiled'].includes(layoutRaw) ? layoutRaw : 'panes';
```

`'tiled'` is in the whitelist, so it passes through correctly once it arrives. But if the renderer ever sends an unrecognized string (e.g. from a legacy call), it silently falls back to `'panes'`, which would explain any cases where even WINDOWS+MULTI failed.

**Bug 3 — Session layout lock-in.**
`cmd_add` (`chq-tmux.sh:368`) reads `@chq_layout` from the running session and ignores the caller's `CHQ_LAYOUT` env unless the option was never set:

```bash
layout=$(tmux show-option -t "$SESSION" -v -q '@chq_layout' ...)
[[ -z "$layout" ]] && layout="${CHQ_LAYOUT:-ittab}"
```

Once a session is started in `tiled` mode, subsequent Deploys are locked to `tiled` regardless of what the renderer sends — because the running session's stashed option takes precedence. The user has to `kill-session` before the layout pill choice takes effect.

### Fix recommendation

1. Rename or relabel the renderer pills so WINDOWS+MULTI → "iTerm Windows" is clearly the "separate movable windows" path. Current UI is ambiguous.
2. The `spawn-agents` fallback (main.js:574) should default to `'ittab'` not `'panes'` — matching `chq-tmux.sh`'s own `CHQ_LAYOUT` default at line 209.
3. Add a renderer hint when the live `@chq_layout` mismatches the selected pill, prompting a kill-session first (the `get-session-layout` IPC already exists at main.js:1114 for exactly this purpose — wire it to the Deploy button).

---

## Complaint 2: Telegram silence

### State observed

- Three bun pollers running (PIDs 10409, 79944, 95880).
- Bun PID 10409 → parent claude PID 10330 (`-n Gekko`); `telegram-trading/bot.pid` = 10423 (the inner `bun server.ts`). **Trading/Gekko telegram is live.**
- Bun PID 95880 → parent claude PID 95831 (`-n Xavier`); `telegram-xavier/bot.pid` = 95891. **Xavier telegram is live.**
- Bun PID 79944 → parent claude PID 79835 (`-n Claude`). No matching `bot.pid` file anywhere for this meta-agent. **Claude/meta-agent has a poller but its state dir is `telegram-tmux-masta/` (per `agent-launch-scripts/.claude/settings.local.json`) and that dir has no `bot.pid`.**
- Lucius (`-n Lucius`) is NOT running. Swarmy is NOT running. Neither has a bun poller.

### Root cause hypotheses (ranked)

**1. Lucius and Swarmy aren't running — their bots are simply offline.**
`chq:0.1` and `chq:0.3` are blank pane titles. No claude processes with `-n Lucius` or `-n Swarmy` exist. No bun pollers for `telegram-rnd` or `telegram-swarmy`. Their bots receive no messages because no agent is listening. This is likely the majority of what Richard is experiencing — most of the fleet is not running.

**2. `telegram-cleanup.sh --pre-launch` has a logic error that kills live pollers.**
`telegram-cleanup.sh:37`:

```bash
if ! ps -p "$PARENT" -o state= 2>/dev/null | grep -qv "T"; then
    kill -9 "$pid"
fi
```

The `grep -qv "T"` check is inverted relative to intent. `grep -qv "T"` returns exit 0 if the parent's state string does NOT contain "T" (i.e., the parent is alive and running). The `!` negation then fires the kill when the parent IS alive. In practice this means every restart kills the existing live bun poller before the new session can claim it, causing a window where the bot is offline. Combined with the auto-restart loop's 3-second gap, there is a brief 409-Conflict-free window followed by silence while the new session spins up.

**3. 409 Conflict if two agents share a token.**
All four primary agents have distinct tokens (8683/8003/8736/8621 per `telegram-routing.md`). No obvious token collision in the current config. Not the root cause here, but remains a latent risk if `settings.local.json` is ever copied without updating the token.

**4. `TELEGRAM_STATE_DIR` missing → session reads no token.**
The plugin reads `TELEGRAM_STATE_DIR` from the project's `settings.local.json`. CorporateHQ, R&D, Trading, and Swarmy all have this set correctly. Agent-launch-scripts has it pointing to `telegram-tmux-masta/` which has a token. This is correctly configured for all current running agents.

### Fix recommendation

1. Start Lucius and Swarmy — that immediately restores their bots.
2. Fix `telegram-cleanup.sh:37`: the condition `grep -qv "T"` should be `grep -q "T"` (without the negation) to correctly match suspended/stopped parents.
3. Optionally add a `bot.pid` write to `telegram-tmux-masta/` so the meta-agent's poller is tracked alongside the others.

---

## Complaint 3: Cannot kill sessions

### Reproduction

From AgentRemote: right-click a tile → KILL PANE. From the tmux session directly: `tmux kill-pane -t chq:0.0`.

### Root cause

The IPC chain is **correctly wired end-to-end**. Specifically:

- `index.html:1974-1979` — KILL PANE popover action calls `tileActionKill(agent)`.
- `index.html:2056-2059` — `tileActionKill` invokes `ipcRenderer.invoke('kill-pane', agent.id)`.
- `main.js:901` — `ipcMain.handle('kill-pane', ...)` is registered and functional.
- `main.js:921` — handler calls `execFile('tmux', ['kill-pane', '-t', m.coord], ...)` — no shell, correct argv.
- `main.js:960` — `attach-pane` handler exists.
- `main.js:751` — `restart-agent` sends `C-c` to the pane's coord.

The kill-pane handler will fail with **"X isn't running in chq — Deploy it first"** if `listPanes()` returns no match. This happens when:

- The agent's `tmuxTarget` in the registry doesn't match the pane's title. The pane title is set by `select-pane -T "$wname"` at spawn and later overwritten by claude's `/rename` via the auto-inject sequence. If `/rename` fires and changes the title to a display name (e.g. "XAVIER") but `tmuxTarget` in `agents.json` is `"xavier"` (lowercase), the `includes(needle)` check at main.js:912 still matches because both sides are lowercased. This part is fine.
- The chq session is in `windows`/`ittab` layout but the pane status poll (`pane-status` IPC at main.js:519) may show panes as "not running" if the title match fails. Current session has `@chq_layout=tiled` — all panes are in `chq:0`, so `listPanes()` should find them.

The most likely failure path for "can't kill sessions":

**The AgentRemote panel shows agents as "not running" (grey tiles) even when they are running, so the KILL PANE action errors with the "isn't running — Deploy it first" guard.** This happens when the pane title has been mutated by `/rename` to the display name (e.g. `⠐ XAVIER`) but the regex match in listPanes against `tmuxTarget` (`xavier`) still works — UNLESS the spinner prefix (`⠐ `) causes a case-sensitive issue. Actually the code lowercases both sides, so the prefix is not the cause.

**More likely: Richard is killing from the tmux command line, not AgentRemote, and hitting a different wall.** `tmux kill-pane -t chq:0.0` would work fine in isolation. The restart loop in `pane_loop` would immediately relaunch the agent in ~3 seconds. If Richard means "kill the session entirely and it won't die", `tmux kill-session -t chq` should always succeed when a session exists. The `kill-session` IPC at main.js:1084 is correctly wired.

**Actual gap:** the KILL PANE IPC fails gracefully but silently — it returns `{ ok: false, error: "..." }` and the renderer shows a toast (`KILL: X ISN'T RUNNING IN CHQ`) but does NOT kill. If AgentRemote's pane-status poll hasn't updated yet (3s interval), the tile may appear running but the coord may be stale after a layout change.

### Fix recommendation

1. After a `kill-session` or layout change, force a pane-status refresh immediately rather than waiting the 3s poll interval.
2. Surface the error string from `kill-pane` more prominently (current toast is easy to miss in the corner).
3. For CLI kill: `bash chq-tmux.sh stop` reliably kills the whole session; `tmux kill-pane -t chq:0.N` kills individual panes. The restart loop will respawn within 3s — if the goal is permanent kill, the pane_loop `auto_restart` flag in `agents.json` is the lever.

---

## Cross-cutting findings

1. **Layout lock-in affects all three complaints.** The running session's `@chq_layout=tiled` means: every Deploy adds panes (not windows), kill-session is required to switch to `ittab`, and the pane-status coord map may be stale after manual layout changes. A single "stop session, re-deploy with WINDOWS+MULTI" would simultaneously fix the layout and give Richard separate iTerm windows.

2. **Lucius and Swarmy are absent.** `chq:0.1` and `chq:0.3` are empty pane slots. Two out of five bots are fully offline. This directly explains at least half of the "nobody's telegram is working" report.

3. **`telegram-cleanup.sh` logic inversion** (line 37) is a latent reliability hazard on every restart, not just initial launch. It should be patched regardless of whether it is the primary cause of the current silence.

4. **pgrep vs ps detection.** `telegram-cleanup.sh:25` uses `pgrep -f "claude.*-n ${AGENT_NAME}"` — the same truncation risk flagged in CLAUDE.md for spawn detection. On macOS, pgrep truncates args beyond ~200 bytes. The full claude invocation is ~230 bytes, so the `-n Name` suffix is reliably within range here, but it is worth noting as a fragility parallel to the spawn-detection issue documented in CLAUDE.md.
