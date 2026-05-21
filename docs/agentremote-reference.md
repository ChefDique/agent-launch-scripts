# AgentRemote Reference

**Current as of:** v1.4.15 (`remote-app/package.json`)
**Scope:** The single "how AgentRemote actually works right now" reference. Grounded in the live `remote-app/` code, not aspiration.

> Keep this doc current by editing it in the same change that alters the behavior it describes. Cite **stable anchors** — IPC channel names, function names, file names — not line numbers, which drift. If this doc and the code disagree, the code wins and this doc is a bug.

Related docs (do not duplicate them here):
- `product/agentremote-prd.md` — why the app exists, must-not-regress rules.
- `product/agentremote.md` — product boundary (in/out of scope).
- `operations/agentremote-operator-contract.md` — canonical "what Richard wants" for spawn/layout/runtime/window/messaging behavior.
- `operations/launch-scripts.md` — launchers, tmux, Swarmy runtime.
- `../DESIGN.md` — visual system and design tokens.

---

## 1. What AgentRemote is

AgentRemote is a lightweight, always-available **local operator HUD** (Electron) for talking to and controlling Richard's local agent fleet. The core value is fast, trustworthy communication: select targets, type or hold-to-talk, send once, and see that it was actually delivered.

It is an operator-station layer. It **controls local processes and tmux panes**; it is not a model client, not a task backend, and not a full command center. It stays **model/runtime agnostic** — it drives whatever runtime (Codex, Claude, Hermes, OpenClaw) the registry says, and must never become a single-vendor tool.

**It is NOT** (see `product/agentremote.md`): ACRM, Atlas, the Swarmy worker-spawn orchestrator, or the canonical memory/task/messaging backend. Swarmy owns the actual deploy/attach/stop/layout runtime (`~/ai_projects/swarmy/scripts/agentremote_runtime.py`); AgentRemote is the UI and local-control layer in front of it.

---

## 2. Operating it (quick start)

| Action | How |
|---|---|
| Launch / relaunch the HUD | `bash launch-remote.sh` (stops prior instances from the canonical checkout, then `open`s a fresh one) |
| Show / hide | Global shortcut `Cmd+Shift+Space`, or `bash launch-remote.sh toggle` (SIGUSR1), or the `.toggle` sentinel file fallback |
| Stop the HUD | `bash launch-remote.sh stop` |
| Select agents | Tap a dock tile (or press its number key `1`–`9`) to toggle-select |
| Send a message | Type in the composer, press Send → broadcast to all selected agents |
| Hold-to-talk | **Hold** an agent's number key `>250ms` → record → release → local transcription → send to that agent |
| Open a live terminal | Open the embedded xterm tile for a selected agent (streams that pane's output, accepts keystrokes/paste) |
| Deploy / attach / stop / restart / kill | Per-agent radial menu actions (deploy via Swarmy runtime; attach surfaces the pane in iTerm control mode) |
| Pet companion | Toggle an agent's floating pet window (separate always-on-top window) |

The version badge shows `v<semver> <branch>@<sha>[*]` (the `*` means the working tree is dirty) so a stale worktree HUD is visually identifiable.

---

## 3. Architecture

### Process model

```
┌─────────────────────────── Electron ───────────────────────────┐
│  Main process (main.js)                Renderer (index.html)     │
│  - IPC handlers (ipcMain.*)    <──IPC──>  - dock / composer / UI │
│  - tmux/iTerm/process control             - embedded xterm tile  │
│  - registry + sidecar I/O                 - voice capture        │
│  - AtlasEventBus                          - pet windows (sep BW)  │
└───────────┬──────────────────────────────────────┬──────────────┘
            │ execFile (argv arrays, never shell strings)
            ▼                                        ▼
        tmux server  ── panes ──►  iTerm2 (control mode -CC viewer)
            ▲
            │ deploy / attach / stop / layout
        Swarmy runtime (agentremote_runtime.py)  ── writes sidecar
```

- **Main ↔ renderer** communicate over IPC. The renderer never touches tmux directly; it asks main.
- **All process/tmux/iTerm control uses argv-style execution** (`execFile`/`execFileSync`), never assembled shell strings — load-bearing for safety and correctness.
- **One agent process → one tmux pane → its own tmux window → surfaced by iTerm control mode** is the intended pane style. A plain `tmux attach` viewer or a merged split-pane window is a workaround, not the design.
- **Swarmy owns the runtime**: deploy/attach/stop/layout call `agentremote_runtime.py`. AgentRemote passes runtime/model/reasoning overrides through and owns the UI, viewer orchestration (iTerm AppleScript), and pane-safety checks.

### Module map (`remote-app/*.js`)

| Module | Owns |
|---|---|
| `main.js` | Electron main process: every IPC handler, tmux/iTerm/process control, registry + sidecar I/O, window lifecycle |
| `tmux-send-path.js` | Two-phase submit args: `tmuxSendLiteralArgs`, `tmuxSendEnterArgs`, `TMUX_SUBMIT_ENTER_DELAY_MS`, `validateTmuxSendTarget`, `normalizeSubmittedText` |
| `pane-resolver.js` | Agent ↔ live pane matching: `resolveAgentPanes` (sidecar pane_id → title fallback → `@agent-identity` owner check) + sidecar pruning helpers |
| `harness-options.js` | Runtime catalog + `normalizeRuntime` (codex/claude/hermes/openclaw; default codex) |
| `harness-models.js` | Per-runtime model & reasoning catalog readers over `config/harness-models.json` |
| `agent-transcript-source.js` | `transcriptMessagesForAgent` — locate an agent's Claude `.jsonl` transcript by cwd→project slug and extract assistant message records |
| `pane-stream-filter.js` | Shared, runtime-agnostic classifier that turns raw pane output into chat-safe prose (ANSI strip, prose detection, symbol-ratio limits) |
| `layout-policy.js` | `normalizeSpawnLayout` + tmux attach command builders (teams/ittab/panes; `-CC` control mode) |
| `deploy-viewer.js` | iTerm viewer readiness/safety: parse tmux clients, require control-mode client for teams/ittab, detect unsafe session groups |
| `iterm-attach.js` | AppleScript builders to open/manage the iTerm control-mode viewer window |
| `tmux-iterm-residue.js` | Clear `@hidden`/buried tmux options left by control-mode attach |
| `terminal-input.js` | Map Option/Alt word-edit keys (Alt+←/→, Alt+B/F/D, Option+Backspace→`C-w`) to tmux key sequences |
| `window-geometry.js` | Main-window sizing/repositioning with workArea clamping |
| `avatar-cropper.js` | Avatar crop math (zoom/pan/crop-rect) for the add/edit form |
| `atlas-event-bus.js` | Typed event bus (`agent_selected`, `message_sent`, `voice_*`, …); deduped log; fans events to renderer + pet windows |

---

## 4. The send / submit path (load-bearing)

**Contract:** "Send means send and submit. Text must not merely appear in a terminal input box waiting for Richard to press Enter." (`operations/agentremote-operator-contract.md`)

### Why submitting is two-phase

Codex, Claude Code, and other raw-mode TUIs do their own line editing. If the literal text and the Enter arrive in a **single `read()`** — which is what one tmux invocation (`send-keys -l text ; send-keys Enter`) produces, because tmux flushes both in one write — the TUI treats the trailing CR as part of a **paste** and inserts a newline into the composer **instead of submitting**. The message then sits unsubmitted until a human presses Enter. (A line-buffered shell reading via `cat` submits either way, which is why this bug hid behind shell tests.)

### The fix (v1.4.15)

Submitting is split into two sends with a delay so the Enter lands in its **own** `read()` as a deliberate keypress:

1. `tmuxSendLiteralArgs(target, text)` → `send-keys -t T -l -- <text>` (literal; `--` protects dash-prefixed payloads; key-looking text like `Enter`/`C-c` stays literal).
2. wait `TMUX_SUBMIT_ENTER_DELAY_MS` (120ms).
3. `tmuxSendEnterArgs(target)` → `send-keys -t T Enter`.

This is **runtime-agnostic** (line-buffered shells still submit) and touches **neither image paste nor Option+Backspace** (separate code paths).

### Where it's applied

- **Composer / broadcast** (`broadcast-message` IPC → `sendKeysToCoord` in `main.js`): resolves selected agents to panes, then two-phase sends per pane. The promise resolves **only after the Enter actually lands**, so the broadcast "sent" count reflects a real submit, not an optimistic one. Emits `message_sent` / `message_failed`.
- **Embedded terminal** (`pane-input` IPC → `submitPaneText` in `main.js`): a lone Enter is sent as an isolated keypress; text + Enter in one payload (and the explicit `submit` flag used by image paste) routes through the same delayed-Enter helper.

**Invariant:** never re-fuse text and Enter into one send for the composer or embedded-terminal submit paths. Regression-guarded by `test/tmux-send-path.integration.test.js`, which asserts two-phase = 2 separate reads (submits) and the combined form = 1 fused read (the bug). See LEARNINGS `LRN-20260521-001`.

---

## 5. Runtime, model & reasoning

Runtime is normalized via `normalizeRuntime` to one of `codex | claude | hermes | openclaw` (default `codex`). The model/reasoning catalog is read fresh from `config/harness-models.json` on every dropdown open.

| Runtime | Default model | Models offered | Reasoning label | Default reasoning | Reasoning levels |
|---|---|---|---|---|---|
| **codex** | `gpt-5.5` | gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.3-codex-spark, gpt-5.2 | thinking level | `xhigh` | low, medium, high, xhigh |
| **claude** | `claude-opus-4-7[1m]` | Opus 4.7 (1M), Opus 4.7, Sonnet 4.6, Haiku 4.5 | effort | `max` | low, medium, high, xhigh, max |
| **hermes** | `default` | default, anthropic/claude-sonnet-4, anthropic/claude-opus-4 | reasoning | `policy-only` | policy-only |
| **openclaw** | `local` | local | thinking | `high` | low, medium, high, xhigh, max |

`applyRuntimePolicy(entry, runtime)` (in `main.js`, run on add/update/form-open) enforces per-runtime invariants on a registry entry:

- **claude:** sets `allow_claude_runtime: true`; deletes `profile_preset`, `sandbox`, `approval_policy`; replaces a gpt-/codex model with the Claude default; upgrades `policy-only`/empty reasoning to `max`.
- **codex:** ensures a supported codex model and a codex reasoning level (rejects `max`/`policy-only`, defaults `xhigh`); sets `sandbox: danger-full-access`, `approval_policy: never`; deletes `allow_claude_runtime` and `startup_injection`.
- **hermes:** deletes `sandbox`/`approval_policy`; requires a provider-qualified model (`vendor/model`) or the Hermes default; reasoning forced to `policy-only`.
- **openclaw:** deletes `sandbox`/`approval_policy`; forces the `local` model; reasoning defaults `high`.

**Claude-runtime gate:** a `runtime: "claude"` entry must carry `allow_claude_runtime: true`. `applyRuntimePolicy` sets it automatically; `launch-agent.sh` enforces it so a Codex path never accidentally launches Claude. Codex is the priority runtime while Claude tokens are constrained — do not flip agents to Claude without explicit intent.

---

## 6. Pane targeting

An agent id resolves to a live tmux pane through `resolveAgentPanes({ agent, panes, sidecar })`:

1. **Sidecar first** — `/tmp/agent-remote-panes.json` maps agent id → stable `pane_id` (`%N`), written by Swarmy's runtime at pane creation. `pane_id` survives agent auto-restart (the pane loop relaunches in the same pane), so the entry is valid until the session ends. This is the preferred, stable match.
2. **Title fallback** — case-insensitive substring match of `agent.tmuxTarget` (or display name) against pane titles.
3. **Owner check** — both the pane's `@agent-identity` tag and the agent id/display name are canonicalized (runtime suffix stripped, lowercased) and must match base; a pane whose `@agent-identity` belongs to a different agent is rejected. This prevents wrong-pane delivery (see LEARNINGS `LRN-20260509-001`). Panes with no `@agent-identity` are not filtered out.

`listPanes()` reads `tmux list-panes -a -F '#{session}:#{window}.#{pane}\t#{pane_id}\t#{pane_title}\t#{@agent-identity}'` in one call.

---

## 7. Deploy, attach & layout

**Layouts** (`normalizeSpawnLayout`): `teams` (iTerm control-mode windows grouped by team — the default), `ittab` (control-mode tabs in one window), `panes` (plain tmux split panes). The chosen layout is stored on the session as the `@chq_layout` user option.

**Deploy** (`spawn-agents` IPC): calls `python3 agentremote_runtime.py add --layout <layout> ...` with per-agent runtime/model/reasoning overrides. Swarmy launches the runtime processes, creates panes, writes the sidecar, and applies the layout. AgentRemote then clears iTerm control-mode residue, ensures a control-mode viewer is attached (launching iTerm via AppleScript if needed), and verifies a real tmux client attached (`deploy-viewer.js` safety checks) rather than reporting optimistic success.

**Attach** (`attach-pane` IPC): if the agent's pane shares a window with siblings it is `break-pane -d`'d into its own window first (one-agent-per-window), then the pane/window are labeled, the sidecar coord updated, residue cleared, and the control-mode client switched to that window. It does not open a plain `tmux attach` viewer.

**Stop/restart/kill:** `kill-pane` and `restart-agent` send Ctrl-C/SIGINT to the agent's pane (non-destructive — Swarmy's loop respawns). `kill-session` tears down the whole `chq` session via the Swarmy runtime.

> Do not validate attach/deploy by mutating Richard's live iTerm desktop unless he asks for that exact live action. Use static tests, mocked IPC, or isolated throwaway tmux sessions first.

---

## 8. Messaging surfaces

- **Composer broadcast** — text input + Send → `broadcast-message` → two-phase send to every selected agent's pane.
- **Embedded terminal tile** — xterm streaming a pane via the pipe (§9). Keystrokes/paste go back via `pane-input`. Word-edit keys (Alt+←/→, Alt+B/F/D, Option+Backspace→`C-w`) are forwarded as real tmux keys, not flattened to inert bytes.
- **Image paste** — `Cmd+V`/`Ctrl+V`/host paste saves the clipboard image to `/tmp/agentremote-pasted-images/` and inserts an `[image: /path]` reference, then submits via the explicit-submit (delayed-Enter) path. A lone SYN byte (`0x16`, plain Ctrl+V) is treated as paste, never forwarded raw.
- **Voice / hold-to-talk** — `transcribe-voice` IPC captures the recorded webm, writes it to `/tmp`, and shells out to a **local `whisper` CLI** (`--output_format txt`, English) — no network STT. The transcript is sent to the held agent. (The whisper binary path is currently machine-specific in `main.js`.)

### Pane streaming pipe (`start-pane-pipe` / `stop-pane-pipe`)

A FIFO at `/tmp/agent-remote-pipe-<id>` plus `tmux pipe-pane` forwards a pane's output bytes to the renderer as `pane-output:<id>` events. One pipe per agent is shared across consumers (terminal tile + pet window) via reference counting; teardown only happens when the last consumer detaches.

---

## 9. Pet chat

Pet windows are separate always-on-top `BrowserWindow`s (`pet-window.html`), opened per agent and sized within fixed geometry bounds, with position persisted.

**Conversation source** (per the contract): for runtimes with structured local transcripts, pet chat reads the **transcript source** (`pet-transcript-tail` → `transcriptMessagesForAgent`) and renders assistant message records — it does **not** scrape raw terminal output. Pane streaming (`pet-pane-tail`/the shared pipe) is a **fallback** for unsupported runtimes, not the primary source for Claude/Codex.

**Filtering** (`pane-stream-filter.js`): a shared, registry/policy-driven classifier — ANSI/control stripping, prose-shape detection, symbol-ratio caps, max rendered lines. It must stay dynamic: **no per-agent, per-model, or per-runtime renderer branches** to hide one failure (see LEARNINGS `LRN-20260508-006/007`). Routing is by direct `from`/`to` identity, never broad name-mention matching. Scrollback must not yank the user to the bottom while they scroll up.

---

## 10. IPC surface (`main.js`)

Stable channel names; `handle` = request/response, `on` = fire-and-forget.

**Registry / agents:** `get-agents`, `add-agent`, `update-agent`, `update-agent-form`, `remove-agent`, `hide-agent`, `unhide-agent`, `reorder-agents`, `update-agent-cwd`, `set-agent-avatar`, `pick-avatar`, `pick-svg`, `pick-cwd`, `read-image-as-data-url`.

**Panes / lifecycle:** `get-pane-sidecar`, `pane-status`, `spawn-agents`, `attach-pane`, `kill-pane`, `restart-agent`, `kill-session`, `get-session-layout`.

**Messaging / streaming:** `broadcast-message`, `pane-input`, `start-pane-pipe`, `stop-pane-pipe`.

**Chat / council:** `chat-tail-init`, `chat-tail-read`, `chat-post`, `council-spawn`, `council-disperse`, `council-list`, `council-transcript-read`.

**Pets:** `show-agent-pet`, `hide-agent-pet`, `agent-pet-state`, `load-agent-pet-state`, `set-agent-pet-selection`, `get-agent-pet-config`, `pet-send-message`, `pet-transcript-tail`, `pet-pane-tail`, `pet-resize-window`, `pet-drag-window`, `pet-drag-end`, `pet-set-mood`, `pet-close-window`, `list-codex-pets`.

**Voice / media / clipboard:** `transcribe-voice`, `save-pasted-image`, `save-native-clipboard-image`, `read-clipboard-text`.

**App / window / config:** `app-build-info`, `get-harness-models`, `resize-window`, `tile-rightclick-suppress`, `list-armory-agents`.

**AtlasEventBus bridge:** `atlas:agent-selected`, `atlas:agent-deselected`, `atlas:voice-start`, `atlas:voice-stop`, `atlas:capability-validate`, `atlas:get-event-log`.

---

## 11. Registry (`agents.json`)

The local fleet registry, consumed by both the launchers and AgentRemote. Common fields: `id`, `display_name`, `runtime`, `model`, `reasoning_effort`, `cwd`, `color`/`theme_color`, `avatar`, `tmux_target`, `startup_slash`, `startup_lines`, `startup_injection`, and runtime-specific fields (`sandbox`, `approval_policy` for codex; `allow_claude_runtime` for claude).

`startup_injection` is the per-agent **startup-injection toggle**: when present, `launch-agent.sh` (on launch and every auto-restart) dismisses the runtime's dev/permission warning intro (a timed keypress — default Enter, or `warning_ack_keys` e.g. `["1","Enter"]`) and then injects the startup command, submitting via the two-phase send (§4). It is **runtime-agnostic** — any runtime can opt in — but Claude-only slash commands (`/color`, `/rename`) are never injected into non-Claude panes. Caveat: AgentRemote's `applyRuntimePolicy` currently strips `startup_injection` from non-Claude agents on add/edit, so a non-Claude agent's injection must be set directly in `agents.json` until that strip is lifted.

- Display names, tmux pane titles, and `tmux_target` are **load-bearing** for process detection and targeting. Claude is detected via `-n <Name>`; Codex/Hermes/OpenClaw rely on the launcher-set tmux title.
- `agents.json` is **gitignored** (machine-local) but currently tracked. App-generated edits (avatars, settings) and runtime flips can appear as dirty state — classify them before committing; do not silently flip the fleet's runtime.
- ACRM is the source of truth for task creation/review and agent lookup/creation decisions; `agents.json` remains the local execution registry and AgentRemote settings source until a live ACRM-backed add-agent path exists.

---

## 12. Testing & verification

```bash
cd remote-app
npm test            # all node test/*.test.js + the bash launcher tests in ../test/
npm run test:policy # pane-stream-filter + runtime-dynamic-contract + renderer-static (policy gates)
```

`npm test` also runs the bash suites: `chq-layout-normalization`, `chq-department-resolution`, `chq-ittab-window-layout`, `launch-agent-runtime`, `chq-codex-runtime-smoke` (note: the codex smoke test kills "stale" MCP helper processes as a side effect).

Key node tests: `tmux-send-path[.integration].test.js` (two-phase submit), `pane-resolver.test.js` (targeting/owner-matching), `harness-models.test.js` (catalog), `terminal-input.test.js` (word-edit keys), `renderer-static.test.js` (renderer/IPC source contracts), `pane-stream-filter.test.js` (pet-chat classifier), `deploy-viewer.test.js` / `layout-policy.test.js` / `iterm-attach.test.js` (deploy/attach/layout).

**Proof before PASS** (`operations/agentremote-operator-contract.md`): do not claim a live AgentRemote/launch/runtime/tmux/input/paste behavior is done from static tests alone. Input changes must prove the actual send/paste/newline path reaches the target; UI changes must prove the running Electron process uses the canonical app path, current version, and branch/commit.

---

## 13. Versioning & packaging

`remote-app/package.json`: `productName: AgentRemote`, `main: main.js`. Bump the version (SemVer) in both `package.json` and `package-lock.json` before committing AgentRemote changes — the HUD's version badge (`v<semver> <branch>@<sha>[*]`, from the `app-build-info` IPC) is how a stale worktree app is spotted. The app pins its Electron name to `AgentRemote` before any userData read so caches don't cross-contaminate with other dev Electron apps.

---

## 14. Invariants that must not regress

- Send means send **and** submit (two-phase; never re-fuse text+Enter). §4
- One agent → one pane → one window → iTerm control mode; no plain-attach or merged split-pane workarounds. §3, §7
- Model/runtime agnostic; no per-agent/model/runtime renderer branches; Codex-priority while Claude tokens are constrained. §5, §9
- argv-style process execution everywhere (no shell strings). §3
- Status/kill/restart/attach/broadcast/voice paths verify the real target/result — no optimistic success. §4, §7
- Dark HUD scrollbar styling on every scrollable surface; no native white scrollbars.
- Before AgentRemote work: read the operator contract and `remote-app/AGENTS.md`, and check `.learnings/LEARNINGS.md`.

Each invariant above is stated as a testable `MUST`/`MUST NOT` with its "don't break X to fix Y" collision pair and evidence in `operations/agentremote-spec-requirements.md` — read that before changing any input/send/runtime/spawn surface.
