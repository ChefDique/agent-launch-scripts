# AgentRemote Recovery List

This is the live punch list for recurring AgentRemote, tmux, iTerm, and pet-chat
regressions Richard has had to restate. Keep it current until each item is
verified by Richard in the running app.

## Operating Rules

- Do not use normal `tmux attach` as a workaround for AgentRemote input bugs.
- Do not merge all live agents into one tmux pane. Preserve one agent process per
  tmux pane.
- Do not validate by mutating Richard's live iTerm/tmux desktop unless he asks
  for that exact live mutation.
- Use isolated worktrees or mocked/throwaway tmux sessions for tests.
- Treat AgentRemote as the operator HUD. Swarmy can later own realtime protocol,
  but this app must remain usable on its own.

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
| Ready for Richard verification | Image/text paste into the embedded xterm viewer should not forward `Ctrl+V` garbage like `0x16`; it should paste clipboard text or an image reference into the target pane. | Open an agent terminal panel, paste text and an image, confirm pane receives readable content. |
| Ready for Richard verification | Pet chat should show only the intended chat/agent stream, not the input box, prompt chrome, statusline, or full terminal screen. | Pet chat view contains clean conversation/output stream only. |
| Ready for Richard verification | Pet chat scrollback should let Richard scroll up without immediately yanking to the bottom. | Scroll up while new output arrives; view stays pinned unless Richard returns to bottom. |
| Open | Visible "do not close" markers must appear on the surface Richard actually sees. Tmux window names alone are insufficient because they may not appear in iTerm chrome. | Screenshot shows obvious KEEP/OK-CLOSE guidance in the visible UI. |
| Ready for Richard verification | AgentRemote must not appear frontmost-but-invisible. If DevToolsActivePort exists but is not listening, treat the HUD as stale/wedged and relaunch canonically. | Screenshot shows the HUD after summon/toggle; DevTools endpoint is reachable or stale file is cleaned. |
| Open | Layout labels must explain the tmux wrap pattern: Tabs/Separate, Panes/Joined, and any future preset names. | Layout picker text makes the underlying tmux pattern clear. |
| Open | Pasting pictures into this Codex chat is outside AgentRemote; do not claim AgentRemote fixes will fix Codex attachment paste. | Separate diagnosis names Codex chat paste as a harness/app issue. |
