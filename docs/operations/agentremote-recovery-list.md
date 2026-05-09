# AgentRemote Recovery List

This is the live punch list for recurring AgentRemote, tmux, iTerm, and pet-chat
regressions Richard has had to restate. Keep it current until each item is
verified by Richard in the running app.

The canonical requirements live in
`docs/operations/agentremote-operator-contract.md`. This recovery list tracks
open/recurring failures against that contract.

## Operating Rules

- Swarmy is the live spawn/summon authority. Neo/`tmux-masta` should not act as
  the live window operator unless Richard explicitly authorizes that live
  mutation in the current turn.
- Do not equate "AgentRemote shows online" with "Richard has a usable terminal."
  Operator-online means a real interactive tmux pane/process exists and can be
  revealed, attached, killed, or relaunched through Swarmy.
- Hermes gateway presence is not the same as an interactive agent pane. A
  gateway-only agent must be labeled as gateway-only, not shown as a usable live
  terminal.
- Internal Codex subagents are invisible to AgentRemote/tmux and must not be
  described as spawned local agents.
- Do not use normal `tmux attach` as a workaround for AgentRemote input bugs.
- Do not merge all live agents into one tmux pane. Preserve one agent process per
  tmux pane.
- Do not validate by mutating Richard's live iTerm/tmux desktop unless he asks
  for that exact live mutation.
- Use isolated worktrees or mocked/throwaway tmux sessions for tests.
- Treat AgentRemote as the operator HUD. Swarmy owns the add/attach/layout
  runtime adapter; AgentRemote calls that adapter and must not revive old
  repo-local launch paths.
- Never close unrelated operator windows as setup. Any iTerm automation must
  create or reuse one marked AgentRemote viewer window only.

## Desired Layout Direction

Richard wants the AgentRemote/Swarmy operator surface to move toward the
BridgeMind-style layout: a direct working control surface, not a marketing page,
with visible agent identity, chat/realtime state, and quick controls. The tmux
underlay must support:

- **Separate tabs/windows mode:** each agent is its own tmux pane, isolated in
  its own tmux window, surfaced through iTerm control mode.
- **Joined panes mode:** the same separate agent panes can be joined into an
  evenly distributed columns/grid layout for laptop or monitor use.
- **Saved presets:** later, preserve useful layouts such as 2x2, 3x3, columns,
  and laptop compact without losing the one-agent-per-pane contract.

## Open Fixes

| Status | Item | Verification |
|---|---|---|
| Ready for Richard verification | Image paste into AgentRemote chat should insert `[image: /tmp/... ]` reliably even when Chromium exposes only a native clipboard image, not a clipboard file item. | Paste a screenshot/image into the main chat input and send to a selected test target. |
| Code fixed; needs Richard live verification | Image/text paste into the embedded xterm viewer should not forward `Ctrl+V` garbage like `0x16`; it should paste clipboard text or an image reference into the target pane. | Open an agent terminal panel, paste text and an image, confirm pane receives readable content. Static renderer test now covers Ctrl+V plus `0x16` suppression. |
| Code fixed; needs Richard live verification | Pet chat should show only the intended chat/agent stream, not the input box, prompt chrome, statusline, full terminal screen, or Codex/Claude TUI thinking/tool transcript lines. | Pet chat now defaults to structured team-chat envelopes only; raw tmux pane streaming is registry opt-in via `pet_pane_stream: true` or `pet_chat_source: "pane"`. Team chat mention filtering ignores unrelated agents merely mentioning the agent by name, and renderer tests cover the stream gate plus TUI noise filters. |
| Ready for Richard verification | Pet chat scrollback should let Richard scroll up without immediately yanking to the bottom. | Scroll up while new output arrives; view stays pinned unless Richard returns to bottom. |
| Open | Visible "do not close" markers must appear on the surface Richard actually sees. Tmux window names alone are insufficient because they may not appear in iTerm chrome. | Screenshot shows obvious KEEP/OK-CLOSE guidance in the visible UI. |
| In progress | AgentRemote viewer attach must refuse unsafe tmux viewer states before opening iTerm: noncanonical grouped sessions such as `chq-swarmy`, or plain tmux clients attached while the requested layout is iTerm control mode. | Static tests cover viewer safety classification; live deploy shows a cleanup error instead of opening more windows. |
| In progress | iTerm attach helper must create/reuse one marked `AgentRemote CHQ Viewer` window and never target `first window`, because that can inject attach commands into unrelated operator work. | Static test confirms the AppleScript searches for the marker and writes only to `targetWindow`. |
| Ready for Richard verification | AgentRemote must not appear frontmost-but-invisible. If DevToolsActivePort exists but is not listening, treat the HUD as stale/wedged and relaunch canonically. | Screenshot shows the HUD after summon/toggle; DevTools endpoint is reachable or stale file is cleaned. |
| Open | AgentRemote online indicators must distinguish interactive pane alive, viewer detached, Hermes gateway-only, and dead/missing pane. | With `chq` absent and Hermes gateways running, UI must not imply Richard has usable live terminals. |
| Open | Runtime picker must be truthful: selecting Claude launches/persists Claude, selecting Codex launches/persists Codex, and each row shows the effective launch runtime before deploy. | Static tests plus launcher resolution prove the selected runtime reaches `launch-agent.sh`; live validation only through Swarmy after Richard authorizes. |
| Open | Layout labels must explain the tmux wrap pattern: Tabs/Separate, Panes/Joined, and any future preset names. | Layout picker text makes the underlying tmux pattern clear. |
| Open | Pasting pictures into this Codex chat is outside AgentRemote; do not claim AgentRemote fixes will fix Codex attachment paste. | Separate diagnosis names Codex chat paste as a harness/app issue. |
