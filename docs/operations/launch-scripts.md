# Launch Scripts And Runtime Notes

## Runtime Shape

The root repo is a set of Bash launchers plus a current Electron HUD under `remote-app/`. There is no root build system. The canonical registry is `agents.json`.

## Primary Entrypoints

| Command | Use |
|---|---|
| `python3 ~/ai_projects/swarmy/scripts/agentremote_runtime.py add [agents...]` | Start/add agents through the Swarmy-owned AgentRemote runtime. |
| `python3 ~/ai_projects/swarmy/scripts/agentremote_runtime.py stop` | Stop the central AgentRemote runtime session. |
| `python3 ~/ai_projects/swarmy/scripts/agentremote_runtime.py attach` | Attach to the current runtime session. |
| `bash launch-agent.sh <id>` | Launch a single configured agent. |
| `bash launch-remote.sh` | Start AgentRemote after killing a prior instance. |
| `bash launch-remote.sh stop` | Stop AgentRemote. |
| `bash scripts/session-end-cleanup.sh` | Session closeout cleanup: stop stale AgentRemote instances across main/worktrees, clear Chromium caches, and report git/worktree/process state. |
| `bash scripts/cron-poke.sh <agent> "message"` | Scheduled tmux send-keys helper. |

## Load-Bearing Invariants

- Agent runtime identity comes from `agents.json`. Claude entries use `-n <Name>` plus `/rename`; Codex/Hermes/OpenClaw entries keep the tmux title set by Swarmy's AgentRemote runtime unless `tmux_target` overrides it.
- The AgentRemote deploy/attach/stop/layout runtime belongs to Swarmy at `~/ai_projects/swarmy/scripts/agentremote_runtime.py`; `chq-tmux.sh` is compatibility/manual fallback, not the app runtime.
- Per-agent scripts should launch the agent and schedule boot-time auto-injects, not own nested restart loops.
- Layout state can persist in the running tmux session through `@chq_layout`.
- Existing process controls should use argv-style calls and surface hard failures when zero panes are targeted.
- AgentRemote Deploy uses the `EACH`/`ittab` control-mode layout. The durable
  unit is one agent process in one tmux pane, with a stable `%N` pane id recorded
  in `/tmp/agent-remote-panes.json`.
- `chq` is the canonical tmux attach target. Grouped aliases such as
  `chq-xavier`, `chq-swarmy`, or `chq-tmux-masta` are recovery residue unless a
  future spec explicitly reintroduces them; AgentRemote must refuse to open a
  viewer while they exist.
- The intended viewing contract is "double wrapped": agent process -> tmux pane
  -> solo tmux window -> iTerm control-mode surface. Richard does not mean a
  normal `tmux attach` grid containing several agent panes in one terminal.
- AgentRemote also exposes an explicit `PANES` layout for the joined view:
  agent processes -> tmux panes joined in one `chq` window -> balanced tmux
  layout. This is an intentional operator mode, not a fallback for Attach bugs.
- Do not implement Attach by opening a normal `tmux attach -t chq` iTerm window,
  splitting the current iTerm session, or otherwise showing multiple agents in
  one tmux window. That makes the panes hard to arrange, resize, or pull apart.
- Do not target `first window` in iTerm automation. Create or reuse the marked
  `AgentRemote CHQ Viewer` window only; unrelated Codex, Claude, or manual
  operator windows are out of scope.
- Separate iTerm windows/tabs are incidental UI materialization. The invariant is
  that each agent pane must be isolated in its own tmux window before iTerm
  control mode presents it.
- Input defects such as image paste or Shift+Enter/newline handling must be fixed
  in AgentRemote/xterm/IPC/input handling. Do not switch to normal `tmux attach`
  or merged split-pane layouts to work around input bugs.
- Do not prove attach/deploy changes by mutating Richard's live iTerm desktop.
  Live validation can leave duplicate tmux clients, headless panes, or stray
  tabs. Use mocked IPC, isolated throwaway tmux sessions, or static command
  checks unless Richard explicitly requests a live desktop mutation.
- Swarmy's AgentRemote runtime enables tmux extended keys for modified-key input such as
  Shift+Enter. iTerm must also emit modified-key sequences from the active
  profile; otherwise tmux only receives a plain Enter.

## Verification

```bash
python3 -m pytest ~/ai_projects/swarmy/tests/test_agentremote_runtime.py -q
bash -n launch-agent.sh launch-remote.sh scripts/cron-poke.sh
bash test/launch-agent-runtime.test.sh
cd remote-app && npm install
bash ../launch-remote.sh
```

Use the Electron duplicate check before and after launch work:

```bash
pgrep -fl "Electron\\.app/Contents/MacOS/Electron \\." | grep remote-app
```

Use the session cleanup script before ending any session that launched,
restarted, or tested AgentRemote, then relaunch the canonical HUD so the
global shortcut still has a live app target:

```bash
bash scripts/session-end-cleanup.sh
bash launch-remote.sh
```

Use `--keep-agentremote` only when the live HUD should intentionally stay
running during cleanup and stale worktree instances have already been ruled
out. Leave AgentRemote stopped only when Richard explicitly asks for that.

## Deferred Decisions

- Whether xterm.js panes replace tmux-pane management in the HUD.
- Whether AgentRemote moves to `~/ai_projects/agent-remote/` before more large UI work.
- Whether legacy remotes should stay in `deprecated/` or be removed after the Electron HUD settles.
