# AgentRemote Feature Index

Task: ALS-QUALITY-001

This inventory is derived from `tasks.json`, `docs/product/agentremote.md`,
`docs/operations/agentremote-operator-contract.md`,
`docs/operations/launch-scripts.md`, `DESIGN.md`, `remote-app/AGENTS.md`,
`remote-app/index.html`, `remote-app/main.js`, the AgentRemote helper modules,
and the test suites under `remote-app/test/` and `test/`.

Live verification note: this document intentionally separates static/unit proof
from live proof. Spawn, attach, stop, restart, layout, iTerm, tmux, and
AgentRemote process checks mutate Richard's desktop or local sessions and require
explicit approval before running.

## Feature Inventory

### 1. AgentRemote HUD Shell

- Purpose: Provide the lightweight local operator HUD for selecting agents,
  sending messages, seeing status, and controlling the fleet without becoming a
  full ACRM or Atlas command center.
- Expected behavior: The HUD stays compact, always-on-top, themeable, and
  optimized for fast communication. It shows visible selected agents, connection
  state, build identity, chat input, deploy controls, and per-agent actions.
- Source files: `remote-app/index.html`, `remote-app/main.js`, `DESIGN.md`,
  `docs/product/agentremote.md`, `docs/operations/agentremote-operator-contract.md`.
- Tests: `remote-app/test/renderer-static.test.js`,
  `remote-app/test/window-geometry.test.js`.
- Manual/live verification requirement: With explicit approval, launch the
  canonical HUD through `bash launch-remote.sh` and verify window placement,
  always-on-top behavior, visible selected agents, and no duplicate stale HUD.

### 2. Registry, Agent Roster, and Agent CRUD

- Purpose: Keep local execution identity, display names, teams, cwd, runtime,
  pane targets, avatars, visibility, and settings registry-first.
- Expected behavior: AgentRemote reads and writes `agents.json`, supports
  add/edit/hide/delete/reorder flows, preserves stable ids, imports Armory data
  when available, and does not hardcode runtime behavior by agent id.
- Source files: `agents.json`, `remote-app/main.js`, `remote-app/index.html`,
  `remote-app/harness-options.js`, `remote-app/harness-models.js`,
  `remote-app/config/harness-models.json`.
- Tests: `remote-app/test/renderer-static.test.js`,
  `remote-app/test/harness-options.test.js`,
  `remote-app/test/harness-models.test.js`,
  `remote-app/test/runtime-dynamic-contract.test.js`,
  `remote-app/test/hermes-openclaw-profile.test.js`.
- Manual/live verification requirement: With approval, edit a noncritical
  registry entry from the HUD, relaunch the HUD, and verify the roster reflects
  the persisted registry state without stale cached model/runtime values.

### 3. Runtime, Model, Reasoning, and Profile Picker

- Purpose: Let operators choose the actual runtime and supported model/profile
  for each agent before spawn, especially while Codex is the priority runtime.
- Expected behavior: The picker is backed by local config, offers Claude, Codex,
  Hermes, and OpenClaw options, refreshes from disk, preserves existing values,
  maps explicit launch overrides into spawn requests, and blocks accidental
  Claude launches unless `allow_claude_runtime: true` is set.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/harness-options.js`, `remote-app/harness-models.js`,
  `remote-app/config/harness-models.json`, `launch-agent.sh`,
  `docs/operations/launch-scripts.md`.
- Tests: `remote-app/test/harness-options.test.js`,
  `remote-app/test/harness-models.test.js`,
  `remote-app/test/hermes-openclaw-profile.test.js`,
  `remote-app/test/renderer-static.test.js`,
  `test/launch-agent-runtime.test.sh`,
  `test/chq-codex-runtime-smoke.test.sh`.
- Manual/live verification requirement: With approval, spawn a disposable or
  approved target for each supported runtime/profile and verify the running pane,
  tmux title, and command argv match the selected settings.

### 4. Spawn and Deploy

- Purpose: Start selected local agents from the HUD through the canonical Swarmy
  AgentRemote runtime rather than ad hoc Electron process logic.
- Expected behavior: Deploy calls
  `/Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py` with
  selected agents, explicit runtime/model/profile overrides, selected layout,
  auto-restart policy, and CWD. It should show a deploy preview and feedback,
  and it must not silently reuse stale runtime state.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/layout-policy.js`, `docs/operations/launch-scripts.md`,
  `docs/operations/agentremote-operator-contract.md`,
  `/Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py`.
- Tests: `remote-app/test/renderer-static.test.js`,
  `remote-app/test/layout-policy.test.js`, `test/chq-layout-normalization.test.sh`,
  `test/chq-ittab-window-layout.test.sh`,
  `test/chq-codex-runtime-smoke.test.sh`.
- Manual/live verification requirement: Requires explicit approval. Use an
  approved disposable fleet or target, deploy from the HUD, and verify actual
  processes, tmux windows, sidecar records, layout, and HUD feedback.

### 5. Layout Selection

- Purpose: Control whether agents launch as team-grouped control-mode windows,
  individual tabs/windows, or joined panes while preserving the operator
  contract.
- Expected behavior: The default layout is `teams`. The allowed values are
  `teams`, `ittab`, and `panes`. `teams` and `ittab` use iTerm/tmux control-mode
  paths. Layout choice must be explicit in spawn args and must not attach a
  normal `tmux attach` viewer as a workaround.
- Source files: `remote-app/layout-policy.js`, `remote-app/index.html`,
  `remote-app/main.js`, `docs/operations/launch-scripts.md`,
  `docs/operations/agentremote-operator-contract.md`, `chq-tmux.sh`.
- Tests: `remote-app/test/layout-policy.test.js`,
  `remote-app/test/deploy-viewer.test.js`,
  `remote-app/test/iterm-attach.test.js`,
  `remote-app/test/renderer-static.test.js`,
  `test/chq-layout-normalization.test.sh`,
  `test/chq-ittab-window-layout.test.sh`.
- Manual/live verification requirement: Requires explicit approval because it
  mutates tmux/iTerm layout. Verify each layout on an approved target, including
  grouped windows, tab/window titles, hidden/buried tmux option cleanup, and HUD
  layout mismatch warnings.

### 6. Attach and Reveal Pane

- Purpose: Bring the correct agent pane into view without confusing current,
  first, or unrelated iTerm sessions.
- Expected behavior: Attach resolves the target pane, rejects unsafe plain tmux
  attach paths, uses a marked AgentRemote viewer path, and verifies the attached
  pane/result before presenting success.
- Source files: `remote-app/main.js`, `remote-app/index.html`,
  `remote-app/iterm-attach.js`, `remote-app/deploy-viewer.js`,
  `remote-app/pane-resolver.js`,
  `docs/operations/agentremote-operator-contract.md`.
- Tests: `remote-app/test/iterm-attach.test.js`,
  `remote-app/test/deploy-viewer.test.js`,
  `remote-app/test/pane-resolver.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: Requires explicit approval. Attach to
  an approved pane and verify the surfaced iTerm viewer is marked, targets the
  expected pane, and does not reuse an unrelated existing tab/window.

### 7. Per-Agent Restart

- Purpose: Restart a single selected agent while preserving registry-backed
  runtime and launch policy.
- Expected behavior: Restart uses the same runtime and model/profile policy as
  spawn, targets the resolved agent identity, updates status, and avoids launcher
  contamination across runtimes.
- Source files: `remote-app/main.js`, `remote-app/index.html`,
  `launch-agent.sh`, `docs/operations/launch-scripts.md`.
- Tests: `remote-app/test/renderer-static.test.js`,
  `test/launch-agent-runtime.test.sh`,
  `test/chq-codex-runtime-smoke.test.sh`.
- Manual/live verification requirement: Requires explicit approval. Restart an
  approved target and verify the old process exits, the new process starts with
  expected argv/runtime, pane title, sidecar state, and HUD status.

### 8. Per-Agent Close and Kill Pane

- Purpose: Let the operator stop one agent pane without tearing down the whole
  session.
- Expected behavior: Close/kill resolves the target pane, sends the intended
  tmux kill action, reports a real result, and does not optimistically mark an
  unrelated pane as stopped.
- Source files: `remote-app/main.js`, `remote-app/index.html`,
  `remote-app/pane-resolver.js`, `docs/operations/agentremote-operator-contract.md`.
- Tests: `remote-app/test/pane-resolver.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: Requires explicit approval. Kill an
  approved disposable pane and verify tmux state, sidecar cleanup, and HUD status
  reflect the actual stopped pane.

### 9. Whole-Session Stop

- Purpose: Stop the AgentRemote-managed session when the selected layout/session
  is no longer desired.
- Expected behavior: The stop-session action calls the approved runtime stop path
  and reports success/failure based on actual result. It must not be used for
  live validation without operator consent.
- Source files: `remote-app/main.js`, `remote-app/index.html`,
  `docs/operations/launch-scripts.md`,
  `/Users/richardadair/ai_projects/swarmy/scripts/agentremote_runtime.py`.
- Tests: `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: Requires explicit approval. Stop only an
  approved AgentRemote session and verify processes, tmux windows, sidecar files,
  and HUD state are gone or updated.

### 10. Status Polling and Online State

- Purpose: Show which agents are actually running and whether target panes can be
  contacted.
- Expected behavior: Status comes from pane/session inspection and sidecar data,
  not optimistic UI state or attached-client presence. Running pane truth should
  drive online dots and action availability.
- Source files: `remote-app/main.js`, `remote-app/index.html`,
  `remote-app/pane-resolver.js`, `remote-app/deploy-viewer.js`.
- Tests: `remote-app/test/pane-resolver.test.js`,
  `remote-app/test/deploy-viewer.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, compare HUD online state
  against `tmux list-panes`/runtime status for an approved session.

### 11. Chat and Broadcast Send

- Purpose: Send text from the HUD to one or more selected agents quickly and
  reliably.
- Expected behavior: Sending submits the message to the agent, not just pastes
  text. Broadcasts are target-aware, use ordered tmux send paths, preserve text
  starting with dashes, and return delivery feedback per target.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/tmux-send-path.js`, `docs/product/agentremote.md`,
  `docs/operations/agentremote-operator-contract.md`.
- Tests: `remote-app/test/tmux-send-path.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, send to an approved
  disposable target and verify the pane receives one submitted message plus
  Enter, with no duplicated paste or missing newline.

### 12. Image Paste and Attachment References

- Purpose: Let the operator paste screenshots/images into chat or terminal flows
  without sending unreadable binary data.
- Expected behavior: Pasted images are saved to readable local paths under the
  AgentRemote attachment directory, converted into text references, and then sent
  through the same reliable message path. Terminal paste must avoid raw control
  bytes such as SYN.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/tmux-send-path.js`, `remote-app/terminal-input.js`,
  `docs/operations/agentremote-operator-contract.md`.
- Tests: `remote-app/test/tmux-send-path.test.js`,
  `remote-app/test/terminal-input.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, paste an image into an
  approved target and verify the agent receives a readable file reference and
  the file exists on disk.

### 13. Inline Terminal Viewer

- Purpose: Provide a read/write terminal surface inside AgentRemote for a
  selected pane without using unsafe attach fallbacks.
- Expected behavior: The terminal overlay starts/stops a pipe-pane stream,
  renders output through xterm, sends typed data through IPC, supports paste, and
  cleans up when hidden or when the target changes.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/terminal-input.js`.
- Tests: `remote-app/test/terminal-input.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, open terminal for an
  approved pane and verify output streaming, input submission, paste handling,
  and cleanup after closing the overlay.

### 14. Tmux Wrapper Input Shortcuts

- Purpose: Preserve normal Codex/iTerm typing behavior inside the tmux wrapper:
  paste images/text into Codex chat, move by word, and delete words without
  raw control/CSI-u bytes appearing in the prompt.
- Expected behavior: The wrapper sets tmux `extended-keys=on` rather than
  `always`, keeps `xterm-keys=on`, binds Option-left/right/backspace/delete and
  Ctrl-left/right/backspace/delete to the readline-compatible keys Codex expects,
  and binds Ctrl/Option-V to the clipboard image/text paste helper.
- Source files: `chq-tmux.sh`, `scripts/paste-clipboard-image-to-pane.sh`,
  `test/chq-ittab-window-layout.test.sh`.
- Tests: `test/chq-ittab-window-layout.test.sh`, `bash -n chq-tmux.sh`.
- Manual/live verification requirement: Restart the affected tmux/iTerm/Codex
  session so terminal key negotiation refreshes, then verify image/text paste,
  Option-backspace, Ctrl-backspace, Option-delete, Ctrl-delete, and word-arrow
  navigation in a real Codex chat prompt. Applying bindings to an already-open
  tmux server is not enough proof because existing iTerm/tmux clients can keep
  stale modified-key negotiation.

### 14b. Embedded AgentRemote Terminal Shortcuts

- Purpose: Make the AgentRemote embedded xterm surface feel like a usable macOS
  terminal for word navigation and deletion.
- Expected behavior: Option/Alt-left and Option/Alt-right map to word movement,
  Option/Alt-backspace/delete and Option-b/f/d map to expected readline escape
  sequences or tmux key names, while normal text and paste continue unchanged.
- Source files: `remote-app/terminal-input.js`, `remote-app/index.html`.
- Tests: `remote-app/test/terminal-input.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, focus an approved
  embedded terminal pane and verify Option-key shortcuts move/delete words
  without inserting control garbage.

### 15. Voice and Local STT

- Purpose: Support hold-to-talk operator messages with local transcription.
- Expected behavior: Number-key hold records local audio, the HUD shows voice
  state, transcription uses local Whisper through IPC, offline/mic errors are
  surfaced, and the transcript is sent through the same broadcast path only when
  a valid target is selected.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `DESIGN.md`, `docs/product/agentremote.md`.
- Tests: `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval and mic access, record a
  short message to an approved target and verify transcript text, delivery
  feedback, and no send when offline or no target is selected.

### 16. Pet Runtime and Pet Window

- Purpose: Display Codex pet companions tied to agent selection, status, and
  lightweight operator awareness.
- Expected behavior: AgentRemote reads pet definitions and spritesheets, shows a
  roster, opens a draggable pet window on the active display, preserves pet
  state, and updates animation/state from selected agent events.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/pet-window.html`, `remote-app/pet-cropper.html`,
  `docs/product/agentremote.md`, `DESIGN.md`.
- Tests: `remote-app/test/renderer-static.test.js`,
  `remote-app/test/window-geometry.test.js`,
  `remote-app/test/avatar-cropper.test.js`.
- Manual/live verification requirement: With approval, open the pet window,
  select agents, drag it between displays, relaunch the HUD, and verify position,
  pet selection, and visible state persist.

### 17. Pet Chat, Transcript, and Stream Filtering

- Purpose: Let the pet show relevant agent communication without leaking raw TUI
  thinking noise or unrelated terminal output.
- Expected behavior: Pet chat prefers structured transcript sources, falls back
  to filtered pane streams only when appropriate, uses registry/policy-driven
  filtering, supports pet replies through the normal send path, and avoids
  per-agent or per-model inline regex hacks in renderer code.
- Source files: `remote-app/pet-window.html`,
  `remote-app/agent-transcript-source.js`,
  `remote-app/pane-stream-filter.js`, `remote-app/pane-resolver.js`,
  `remote-app/main.js`, `remote-app/index.html`,
  `docs/operations/agentremote-operator-contract.md`.
- Tests: `remote-app/test/agent-transcript-source.test.js`,
  `remote-app/test/pane-stream-filter.test.js`,
  `remote-app/test/pane-resolver.test.js`,
  `remote-app/test/runtime-dynamic-contract.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, run pet chat against
  approved Claude and Codex panes and verify displayed lines are transcript-like,
  actionable, and target-correct.

### 18. Sidecar, Pane Identity, and Message-Agent Metadata

- Purpose: Keep delivery and status tied to the actual live pane rather than
  stale registry coordinates.
- Expected behavior: Launchers and AgentRemote write sidecar records with pane
  identity and message-agent identity, resolve by sidecar first, fall back by
  title when necessary, prune stale records, and expose target metadata for send,
  status, and pet chat.
- Source files: `remote-app/main.js`, `remote-app/pane-resolver.js`,
  `launch-agent.sh`, `agents.json`,
  `docs/operations/agentremote-operator-contract.md`.
- Tests: `remote-app/test/pane-resolver.test.js`,
  `remote-app/test/tmux-send-path.test.js`,
  `test/launch-agent-runtime.test.sh`.
- Manual/live verification requirement: With approval, start an approved agent,
  inspect the sidecar and tmux pane id, send a message, and verify resolution
  follows the live pane after restart or pane id changes.

### 19. Startup Injection and Pre-Launch Hooks

- Purpose: Allow selected startup prompts or pre-launch commands while keeping
  runtime contamination out of cross-runtime launch paths.
- Expected behavior: `launch-agent.sh` builds argv arrays per runtime,
  startup injection is Claude-only and opt-in through `startup_injection`,
  pre-launch commands run only when configured, and Codex/Hermes/OpenClaw do not
  inherit Claude startup behavior.
- Source files: `launch-agent.sh`, `agents.json`,
  `docs/operations/launch-scripts.md`, `remote-app/main.js`,
  `remote-app/index.html`.
- Tests: `test/launch-agent-runtime.test.sh`,
  `test/chq-codex-runtime-smoke.test.sh`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, launch approved test
  agents for Claude and Codex and verify only Claude receives configured startup
  injection while other runtimes use clean argv.

### 20. Codex Lifecycle Hooks

- Purpose: Keep Codex lifecycle automation explicit, auditable, and compatible
  with operator expectations.
- Expected behavior: Hook docs and scripts describe installed Codex lifecycle
  hooks, provide audit coverage, avoid hidden mutation, and preserve message
  routing/cleanup behavior across harness runs.
- Source files: `docs/operations/codex-lifecycle-hooks.md`,
  `scripts/codex-lifecycle-hook.sh`,
  `scripts/audit-codex-lifecycle-hooks.sh`, `launch-agent.sh`.
- Tests: `scripts/audit-codex-lifecycle-hooks.sh` static audit path,
  `test/launch-agent-runtime.test.sh`.
- Manual/live verification requirement: Manual proof should inspect hook install
  state and run audit scripts only with operator consent if they touch live Codex
  configuration or running sessions.

### 21. Session-End Cleanup

- Purpose: Leave the operator station in a known state after AgentRemote work.
- Expected behavior: `scripts/session-end-cleanup.sh` stops stale Electron HUDs
  from the canonical checkout/worktrees, clears AgentRemote Chromium caches while
  preserving `Local Storage/` and `pet-state.json`, prints git/worktree/process
  status, and supports `--keep-agentremote` when preserving a live HUD is
  intentional.
- Source files: `scripts/session-end-cleanup.sh`, `AGENTS.md`,
  `docs/operations/launch-scripts.md`.
- Tests: Shell syntax checks; operational validation is live by nature.
- Manual/live verification requirement: Requires explicit approval if it stops
  processes. After any approved AgentRemote launch/restart/test, run the cleanup
  hook and relaunch canonical HUD unless Richard asked to leave it stopped.

### 22. Version and Build Badge

- Purpose: Make stale HUDs and wrong worktree builds visible to the operator.
- Expected behavior: The HUD shows `v<semver> <branch>@<sha>`, includes dirty
  and path context in detail/tooltip data, and reflects `remote-app/package.json`
  version bumps for app edits.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/package.json`, `remote-app/package-lock.json`, `AGENTS.md`.
- Tests: `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, launch the HUD and verify
  the visible badge matches `remote-app/package.json`, current branch, commit,
  dirty state, and checkout path.

### 23. Global Summon, Window Geometry, and Click-Through

- Purpose: Keep AgentRemote quickly accessible without blocking normal desktop
  work.
- Expected behavior: Global shortcuts summon/focus the HUD, window bounds are
  saved/restored safely, click-through can be toggled for pet/HUD surfaces, and
  hidden windows remain recoverable.
- Source files: `remote-app/main.js`, `remote-app/index.html`, `DESIGN.md`.
- Tests: `remote-app/test/window-geometry.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, verify shortcut summon,
  restored geometry across relaunch, and click-through behavior on the active
  display.

### 24. Keyboard Selection Shortcuts

- Purpose: Let the operator select or voice-target agents without leaving the
  keyboard.
- Expected behavior: Number shortcuts toggle visible agents, command-number can
  attach to corresponding agents, and long-press number-key voice capture routes
  to the intended selected target.
- Source files: `remote-app/index.html`, `DESIGN.md`.
- Tests: `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, verify number-key
  selection, command-number attach targeting, and long-press voice routing on an
  approved roster.

### 25. Team Chat and Council Overlay

- Purpose: Provide a lightweight operator-side discussion surface for team
  coordination and review/council events without folding AgentRemote into a full
  task system.
- Expected behavior: Team chat opens from the HUD, posts messages through IPC,
  watches for updates, supports council thread metadata, and remains separate
  from pane delivery.
- Source files: `remote-app/index.html`, `remote-app/main.js`.
- Tests: `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, open the overlay, post to
  a noncritical team channel, and verify persistence/watch updates without
  sending pane messages.

### 26. Avatar, Pet, and Visual Asset Editing

- Purpose: Let operators visually identify agents and pets from the HUD.
- Expected behavior: Avatar pickers and cropper flows store image references,
  render roster thumbnails, and keep visual identity separate from runtime
  identity and targeting.
- Source files: `remote-app/index.html`, `remote-app/main.js`,
  `remote-app/pet-cropper.html`.
- Tests: `remote-app/test/avatar-cropper.test.js`,
  `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, change an avatar on a
  disposable or approved entry and verify the image persists after HUD relaunch
  without changing agent id, runtime, or pane target.

### 27. Appearance, Scrollbars, and Modal Usability

- Purpose: Keep the HUD usable during repeated operator work and prevent bright
  native UI regressions.
- Expected behavior: Scrollable modals, pickers, overlays, roster areas, logs,
  and pet windows use dark HUD scrollbar styling. Text, controls, and overlays
  should fit their containers at supported window sizes.
- Source files: `remote-app/index.html`, `remote-app/pet-window.html`,
  `remote-app/pet-cropper.html`, `remote-app/AGENTS.md`, `DESIGN.md`.
- Tests: `remote-app/test/renderer-static.test.js`,
  `remote-app/test/window-geometry.test.js`.
- Manual/live verification requirement: With approval, inspect all scrollable
  overlays in the live HUD at compact and expanded sizes.

### 28. Event Log and Debug IPC

- Purpose: Surface operational feedback for spawn, send, attach, voice, status,
  and external event streams.
- Expected behavior: Renderer logs meaningful status/events, IPC handlers return
  structured success/error payloads, and Atlas/event-bus style channels remain
  auxiliary rather than the product center.
- Source files: `remote-app/index.html`, `remote-app/main.js`.
- Tests: `remote-app/test/renderer-static.test.js`.
- Manual/live verification requirement: With approval, trigger approved spawn,
  send, voice, and status actions and verify the HUD displays useful result
  text without claiming success before the underlying operation returns.

## Static Verification Surface

Safe static checks for this inventory:

- `bash -n launch-agent.sh launch-remote.sh chq-tmux.sh scripts/cron-poke.sh scripts/session-end-cleanup.sh scripts/audit-codex-lifecycle-hooks.sh scripts/codex-lifecycle-hook.sh`
- `cd remote-app && node --test test/*.test.js`
- `git diff -- docs/product/agentremote-feature-index.md`
- `git status --short --branch`

Checks intentionally not included without explicit approval:

- `bash launch-remote.sh`
- `bash launch-remote.sh stop`
- Swarmy `agentremote_runtime.py deploy`, `attach`, `stop`, or layout commands
- `osascript` attach flows
- Any command that mutates Richard's live iTerm, tmux, AgentRemote session, or
  desktop layout
