# Launch Scripts And Runtime Notes

> **2026-06-19 update — native single-window spawn.** AgentRemote now owns its
> spawn path natively (`remote-app/tmux-deploy.js`): all selected agents land as
> tiled panes in ONE tmux window. Swarmy is an optional `AGENTREMOTE_SPAWN=swarmy`
> fallback (and still bridges attach/stop for now). The canonical behavior source
> is `docs/operations/agentremote-operator-contract.md`; any section below that
> still describes the swarmy-owned multi-window model is superseded by it.

## Runtime Shape

The root repo is a set of Bash launchers plus a current Electron HUD under `remote-app/`. There is no root build system. The canonical registry is `agents.json`.

## Ownership Boundary

AgentRemote owns its native spawn path (`tmux-deploy.js`): one tmux session, one
window, agents as tiled panes. Swarmy is an optional fallback
(`AGENTREMOTE_SPAWN=swarmy`) and still bridges attach/stop until those are also
native. Neo/`neo` should not manually repair live iTerm/tmux state, detach
clients, open viewers, or spawn live agents unless Richard explicitly asks for
that live mutation in the current turn.
If the canonical checkout already has unrelated dirty AgentRemote/runtime state,
open an isolated worktree for the new fix before editing so title/runtime
patches do not get mixed into shared live evidence.

Do not call a system healthy because a gateway process is alive. For operator
purposes, an agent is usable only when an interactive tmux pane/process exists
and Swarmy can reveal or control it. Hermes gateway-only state must be labeled as
gateway-only.

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
| `bash scripts/audit-codex-lifecycle-hooks.sh` | Verify Codex lifecycle hook readiness and dry-run `/chores`/`/done` checkpoint nudges. |
| `bash scripts/cron-poke.sh <agent> "message"` | Scheduled tmux send-keys helper. |

## Load-Bearing Invariants

- Agent runtime identity comes from `agents.json`. Visible tmux pane/window
  labels must come from `display_name`. Claude entries still pass `-n <Name>`
  and may use `/rename`; Codex can keep its own terminal title config, but
  AgentRemote-owned tmux sessions set `allow-set-title off` so application title
  escape sequences cannot overwrite the top tmux pane label.
- Runtime selection must be explicit and truthful. If the UI says Claude, the
  registry/update path must persist `runtime: "claude"` and
  `allow_claude_runtime: true`; if the UI says Codex, it must persist
  `runtime: "codex"` and remove Claude-only opt-in fields. Do not silently reuse
  a stale runtime under the same display name.
- Codex model selection comes from the local Codex config/catalog/env capability
  source, not a stale one-model UI list. AgentRemote reads
  `AGENTREMOTE_CODEX_DEFAULT_MODEL`, `SWARMY_CODEX_DEFAULT_MODEL`,
  `CODEX_CONFIG`/`~/.codex/config.toml`, `~/.codex/models_cache.json`, and the
  optional `AGENTREMOTE_CODEX_MODELS` / `SWARMY_CODEX_MODELS` allowlist. The
  launcher rejects a Codex model outside the same supported set before `codex`
  is execed.
- The AgentRemote deploy/attach/stop/layout runtime belongs to Swarmy at `~/ai_projects/swarmy/scripts/agentremote_runtime.py`; `chq-tmux.sh` is compatibility/manual fallback, not the app runtime.
- Per-agent scripts launch the configured runtime and clean stale Claude delayed
  injection jobs for Claude tmux launches. Boot-time injection is driven by
  `startup_injection`, for example:
  `{ "include": ["dangerous_permission_enter", "startup_lines"], "exclude": [] }`.
  `exclude` always wins.
- **Claude default-on (dynamic — no per-agent entry required).** For the `claude`
  runtime, BOTH `dangerous_permission_enter` and `startup_lines` default ON via
  `startup_injection_active()`. A Claude agent with no `startup_injection` object
  at all (e.g. a freshly migrated agent like `dasha`) still gets the warning-ack
  Enter AND its startup lines. Opt out per token with `startup_injection.exclude`.
  Non-Claude runtimes (Codex/Hermes/OpenClaw) still require explicit `include`, so
  they never receive a stray Enter or the Claude-only `/color`/`/rename`.
- `dangerous_permission_enter` is the initial Enter that accepts Claude's
  development-channel/permission warning (Claude always launches with
  `--dangerously-load-development-channels`, which raises it every start).
- `startup_lines` schedules either registry startup lines or the legacy fallback
  `/color` + `/rename` + `startup_slash`. Registry `startup_lines` supports
  `{{color}}`, `{{rename_to}}`, `{{startup_slash}}`, `{{display_name}}`,
  `{{agent_id}}`, and `{{cwd}}`. An explicit empty `startup_lines: []` disables the
  legacy fallback. For the Claude runtime, when `startup_slash` is null or empty it
  defaults to `/lead-gogo` (mirrors the HUD `DEFAULT_LEAD_STARTUP_SLASH`) unless a
  `STARTUP_SLASH=` env override clears it. `read_startup_lines` always returns
  success, so an empty `startup_slash` can never abort the launch.
- Layout state can persist in the running tmux session through `@chq_layout`;
  Swarmy also records browser-safe team layout metadata in
  `@swarmy_team_layout`.
- Existing process controls should use argv-style calls and surface hard failures when zero panes are targeted.
- AgentRemote Deploy defaults to `TEAMS`: selected agents are grouped by
  `team`/`team_id` from `agents.json`; each team becomes a balanced tmux window
  surfaced through iTerm control mode. Agents without team metadata use the
  `default` team, which gives the expected single balanced operator window for
  an ad-hoc four-agent swarm.
- `agents.json` also carries `_profile_presets` and `_team_preset_templates` so
  a launcher can choose a swarm by intent instead of hand-building entries. A
  team template names the built-in team, default profile preset, layout, selection
  tags, and member overrides. For AgentRemote, every template is now required to
  use `layout: "teams"` and must resolve its `default_profile_preset` (plus any
  override values) to an existing `_profile_presets` entry.
- Profile presets are also structurally validated before being projected into
  launch requests. Each preset must define:
  - `workspace.cwd_mode`
  - `workspace.worktree_strategy`
  - `local.mode` and `local.attach`
  - `sandbox.mode` and `sandbox.approval_policy`
  - `skills.mode` and `skills.allowed_skills` (array)
- AgentRemote also exposes `TABS`/`ittab`: one agent process in one tmux pane
  in one solo tmux window, surfaced through iTerm control mode. The durable unit
  is still the stable `%N` pane id recorded in `/tmp/agent-remote-panes.json`.
- `chq` is the canonical tmux attach target. Grouped aliases such as
  `chq-xavier`, `chq-swarmy`, or `chq-neo` are recovery residue unless a
  future spec explicitly reintroduces them; AgentRemote must refuse to open a
  viewer while they exist.
- The intended default viewing contract is team wrapped: agent process -> tmux
  pane -> balanced team tmux window -> iTerm control-mode surface. Richard does
  not mean a normal `tmux attach` grid containing several agent panes in one
  terminal.
- AgentRemote also exposes an explicit `PANES` layout for the joined view:
  agent processes -> tmux panes joined in one `chq` window -> balanced tmux
  layout. This is an intentional operator mode, not a fallback for Attach bugs.
- Do not implement Attach by opening a normal `tmux attach -t chq` iTerm window,
  splitting the current iTerm session, or otherwise showing multiple agents in
  one tmux window. That makes the panes hard to arrange, resize, or pull apart.
- Do not target `first window` in iTerm automation. Create or reuse the marked
  `AgentRemote CHQ Viewer` window only; unrelated Codex, Claude, or manual
  operator windows are out of scope.
- Separate iTerm windows/tabs are incidental UI materialization. The invariant
  for `TEAMS` is one balanced tmux window per team; the invariant for `TABS` is
  one isolated tmux window per agent before iTerm control mode presents it.
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
python3 -m py_compile ~/ai_projects/swarmy/scripts/agentremote_runtime.py
bash -n launch-agent.sh launch-remote.sh scripts/cron-poke.sh
bash scripts/audit-codex-lifecycle-hooks.sh
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
