# Launch Scripts And Runtime Notes

## Runtime Shape

The root repo is a set of Bash launchers plus a current Electron HUD under `remote-app/`. There is no root build system. The canonical registry is `agents.json`.

## Primary Entrypoints

| Command | Use |
|---|---|
| `bash chq-tmux.sh start [agents...]` | Start the central multi-agent tmux session. |
| `bash chq-tmux.sh stop` | Stop the central session. |
| `bash chq-tmux.sh attach` | Attach to the current session. |
| `bash launch-agent.sh <id>` | Launch a single configured agent. |
| `bash launch-remote.sh` | Start AgentRemote after killing a prior instance. |
| `bash launch-remote.sh stop` | Stop AgentRemote. |
| `bash scripts/session-end-cleanup.sh` | Session closeout cleanup: stop stale AgentRemote instances across main/worktrees, clear Chromium caches, and report git/worktree/process state. |
| `bash scripts/cron-poke.sh <agent> "message"` | Scheduled tmux send-keys helper. |

## Load-Bearing Invariants

- Agent runtime identity comes from `agents.json`. Claude entries use `-n <Name>` plus `/rename`; Codex/Hermes/OpenClaw entries keep the tmux title set by `chq-tmux.sh` unless `tmux_target` overrides it.
- The tmux restart loop belongs in `chq-tmux.sh` and related tmux orchestrators.
- Per-agent scripts should launch the agent and schedule boot-time auto-injects, not own nested restart loops.
- Layout state can persist in the running tmux session through `@chq_layout`.
- Existing process controls should use argv-style calls and surface hard failures when zero panes are targeted.

## Verification

```bash
bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh
bash test/launch-agent-runtime.test.sh
cd remote-app && npm install
bash ../launch-remote.sh
```

Use the Electron duplicate check before and after launch work:

```bash
pgrep -fl "Electron\\.app/Contents/MacOS/Electron \\." | grep remote-app
```

Use the session cleanup script before ending any session that launched,
restarted, or tested AgentRemote:

```bash
bash scripts/session-end-cleanup.sh
```

Use `--keep-agentremote` only when the live HUD should intentionally stay
running after handoff.

## Deferred Decisions

- Whether xterm.js panes replace tmux-pane management in the HUD.
- Whether AgentRemote moves to `~/ai_projects/agent-remote/` before more large UI work.
- Whether legacy remotes should stay in `deprecated/` or be removed after the Electron HUD settles.
