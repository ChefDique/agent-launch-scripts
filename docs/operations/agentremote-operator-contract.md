# AgentRemote Operator Contract

This is the canonical "what Richard wants" contract for AgentRemote and the
local summon/runtime path. Every AgentRemote, launch-script, Swarmy-adapter, or
tmux/iTerm change must preserve this file before claiming success.

## Product Intent

Richard wants a direct local operator surface:

1. Pick the agent or team.
2. Pick the runtime/model/profile.
3. Click spawn, attach, stop, restart, or send.
4. See the right live agent surface appear where he can work.
5. Leave the machine without stale windows, phantom sessions, or wrong-runtime
   panes being left behind.

AgentRemote is the lightweight desktop HUD for this. Swarmy owns the live
runtime adapter. ACRM/Armory owns durable registry/task/profile management.
AgentRemote must not become a full browser command center, and Swarmy must not
hide runtime failures behind optimistic UI state.

## Non-Negotiable Outcomes

- A button selection must map to the actual spawned runtime. If Richard selects
  Claude, the launched process must be Claude Code. If he selects Codex, the
  launched process must be Codex. Do not silently reuse a stale runtime, model,
  profile preset, sandbox policy, or approval policy from a prior row.
- Agent creation and launch are dynamic. Do not hardcode Xavier, Swarmy,
  Neo/`tmux-masta`, or any other agent as a special case unless the
  registry/profile explicitly declares that behavior.
- AgentRemote must not turn every new terminal into a Codex harness. Manual
  Terminal or iTerm windows are Richard's unless explicitly created by the
  AgentRemote/Swarmy marked viewer path.
- A live Hermes gateway is not a visible interactive agent. Gateway-only state
  must be labeled as gateway-only and must not be counted as a usable pane.
- Internal Codex subagents are not AgentRemote agents. They are invisible to
  tmux/iTerm and must not be described as spawned local agents.

## Runtime Ownership

- Swarmy is authoritative for spawn, attach/reveal, kill, relaunch, status,
  layout, runtime choice, and tmux identity.
- AgentRemote is a HUD over Swarmy state and commands. It can request actions
  and display proof; it should not reimplement a competing runtime path.
- `launch-agent.sh` is the per-agent launcher called by the runtime adapter. It
  must build argv arrays and must not assemble Codex, Claude, Hermes, OpenClaw,
  tmux, or iTerm commands as shell strings.
- Compatibility launchers such as `chq-tmux.sh` are fallback/manual surfaces.
  They must not be revived as the default app runtime unless this contract is
  intentionally changed.

## Pane And Layout Contract

The durable unit is one live agent process in one tmux pane with a stable `%N`
pane id. As of commit `fcbedbc` (2026-05-09), the canonical pane-binding mechanism
is the tmux user option `@agent-identity` set on the pane at listener startup:

```bash
tmux set-option -p -t <pane_id> @agent-identity <identity>
```

The `pane_resolver` queries this option as its **primary resolution path**. It
bypasses `/tmp/agent-remote-panes.json` entirely when the tag is set and the pane
is live. Sidecar entries in `/tmp/agent-remote-panes.json` are advisory — used
only when the tag is absent or the tagged pane is dead. Registry entries
(`agentremote_pane_id` in `registry/agents.local.json`) remain as a secondary
fallback.

Resolver order (most → least authoritative):
1. tmux `@agent-identity` user option on a live pane → `source=tmux-tag`
2. `/tmp/agent-remote-panes.json` sidecar lookup → `source=registry` or `source=suffix`
3. Registry coord fallback

Supported materializations:

- `teams`: one balanced tmux window per team, surfaced through iTerm control
  mode. This is the default operator layout for grouped work.
- `tabs` / `ittab` / `separate`: each agent pane is isolated in its own tmux
  window, then surfaced through iTerm control mode. This is the movable,
  pull-apart layout Richard wants available.
- `panes` / `joined`: the same separate agent panes can be intentionally joined
  into one balanced tmux grid for laptop or monitor use.

Forbidden materializations:

- Do not merge multiple agents into one ordinary terminal as a workaround for
  input bugs.
- Do not open a normal `tmux attach -t chq` viewer to fake success.
- Do not split the current unrelated iTerm session to display AgentRemote panes.
- Do not target iTerm's `first window` or `current session`; create or reuse one
  marked AgentRemote viewer window only.

Layout controls must explain the tmux pattern underneath the label, so future
operators can distinguish separate tabs/windows from joined panes.

## Window Hygiene

- AgentRemote/iTerm automation may create or reuse only a marked target window,
  such as `AgentRemote CHQ Viewer`, unless Richard explicitly asks for live
  desktop mutation in the current turn.
- Stale control-mode windows, detached viewers, helper shells, and Default
  windows with old attach commands are failures. They must be cleaned or
  reported as blockers before claiming done.
- Closeout must not leave visible junk windows, hidden respawn loops, stale
  Electron worktree apps, or ambiguous dirty state.
- Richard must be able to open a normal terminal without it becoming an agent
  harness.
- Visible "keep open / ok close" guidance must appear on the actual surface
  Richard sees when a window is owned by the agent system. Tmux title text alone
  is not enough.

## Messaging And Input

- Send means send and submit. Text must not merely appear in a terminal input
  box waiting for Richard to press Enter.
- Image paste into AgentRemote chat should produce a readable image reference
  that can be sent to a selected target.
- Terminal/xterm paste must not forward raw control garbage such as `0x16`.
- Shift+Enter/newline behavior must be fixed in input handling, tmux extended
  keys, or iTerm profile behavior, not by switching layout architecture.
- Pet chat must show the relevant conversation/output stream only. It must not
  show the Codex prompt input hint, terminal statusline, full terminal chrome,
  or unrelated agents' streams.
- For runtimes with structured local transcripts, pet chat should read the
  transcript source and extract assistant message records rather than scrape
  raw terminal output. Pane streaming is a fallback for unsupported runtimes or
  explicit registry policy, not the primary chat source for Claude/Codex.
- Pet chat filtering must be dynamic and registry/policy driven. Do not add
  per-agent, per-model, or per-runtime renderer branches to hide one visible
  failure. Stream filtering must live behind a tested shared classifier or
  policy module with behavior fixtures that cover multiple harness shapes.
- Pet chat scrollback must let Richard scroll up without being immediately
  yanked to the bottom. Auto-follow should resume only when Richard returns to
  the bottom or explicitly anchors there.

## Floating Pet Behavior

- Dragging a pet must be reliable over terminal windows and other desktop
  surfaces. Use pointer capture/native window movement instead of fragile
  click-through behavior.
- Held/moving animation should reflect the intended sprite state. For example,
  kid Goku held and moved right/left should use the cloud-flying direction state,
  not random action rows.
- Pet windows should spawn and stay on the active/current display where Richard
  is working, not only the laptop screen.

## Proof Before PASS

Do not claim success from static config alone when the user asked for a live
summon or usable operator surface.

Required proof depends on the change:

- Runtime changes: prove the effective command, runtime, model/profile, cwd, and
  pane id match the user's selection.
- Layout changes: prove the tmux window/pane topology and the iTerm/viewer
  materialization match the selected layout.
- Input changes: prove the actual send/paste/newline path reaches the target.
- UI changes: prove the visible running Electron process uses the canonical
  `--app-path`, current version, current branch/commit, and intended display.
- Cleanup changes: prove remaining tmux sessions, clients, Electron processes,
  iTerm viewer windows, worktrees, and dirty files are understood.

If live desktop validation is required, ask or confirm first unless Richard
already explicitly requested that exact mutation in the current turn.

## Testing Rules

- Use isolated worktrees or mocked/throwaway tmux sessions for tests by default.
- Do not use Richard's live iTerm/tmux desktop as the test harness.
- Do not interrupt active/live interactive sessions during tests.
- Before deleting old locations or compatibility paths, keep the GitHub-backed
  repo state intact and wait for Richard's verification.
- A green unit test is not a live summon PASS. It is only one evidence layer.

## Closeout Rules

Before saying the work is done:

1. Classify dirty files.
2. Confirm whether AgentRemote is running from the canonical checkout.
3. Confirm whether any stale worktree Electron or iTerm control-mode windows
   remain.
4. Confirm tmux sessions, clients, and pane-binding health: verify `@agent-identity` tags are set on listener panes (`tmux list-panes -a -F '#{pane_id} #{@agent-identity}'`). If absent, run `scripts/tag_existing_claude_panes.sh`. Check `/tmp/agent-remote-panes.json` only as a secondary diagnostic.
5. State what was not live-tested and why.

If any of these are unknown, say "not done" and name the blocker.
