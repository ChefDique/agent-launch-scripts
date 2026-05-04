# ALS-002 — Renderer regression audit (HEAD 38738d2 vs legacy 7931e16)

## Summary
The Stitch design port (38738d2) shrank the renderer from 6342 to 2372 lines. It preserved
the core deploy/broadcast/add-agent/tile-popover loop but stripped the entire voice/Whisper
stack, both keybinding layers (hold-to-voice 1-9, Cmd+digit attach, dblclick attach), the
per-agent `radial-settings` panel, the 3s `pane-status` poller, the `detach-pane-to-window`
/ `detach-pane-to-split` IPC pair, and all `body.editing` edit-mode wiring (the EDIT button
exists but is a no-op placeholder at line 1472).

---

## Critical gaps (block daily operator use)

### 1. Voice / Whisper hold-to-record entirely removed
**Legacy:** lines 356–619 (CSS), 5041–5508 (JS state machine + MediaRecorder + AnalyserNode
+ `transcribe-voice` IPC + `showVoiceToast` + `showTranscriptBubble`).  
**Current:** no `voiceRec` object, no `getUserMedia`, no `MediaRecorder`, no `AnalyserNode`,
no `fkey-badge` DOM element (replaced by `agent-key` which shows the label, not a keycap
badge), no CSS for `voice-recording`, `voice-recording-tile`, `voiceAurora`, `voiceCancelShake`,
`.voice-transcript`, or `.voice-toast`.  
**Missing:** the entire dictation workflow — hold number key > 250 ms to record audio for a
specific agent, audio analyser ring on the avatar, aurora bloom on the active tile, dim-other-tiles,
live transcript bubble above the tile, Esc-to-cancel-shake, finish-on-release, whisper
shell-out via `transcribe-voice` IPC, voice-toast confirmation bar, and window-blur leak-guard.

### 2. Number-key hold/tap dual path broken — tap-toggle maps only keys 1-5 by label, not dock position
**Legacy:** lines 5507–5580 — bare digit 1-9 triggers `toggleAgent(fkeyAgentId(idx))` where
`idx` is the current dock display order. Hold > 250 ms arms `startVoiceRecording`.  
**Current:** line 2335 — `if (/^[1-5]$/.test(e.key)) toggleAgent(e.key)` passes the literal
key character as the agent id, not a dock-order index. Five agents hard-coded; beyond five is
silent. No `FKEY_MAP`, no `fkeyAgentId()`, no dock-position indirection. Any agent whose id
does not equal its number-key literal is silently not toggled.

### 3. Cmd+digit (1-9) attach shortcut removed
**Legacy:** lines 5012–5040 — `window.addEventListener('keydown')` with `ev.metaKey` gate,
digit 1-9 mapped to dock order via `agentOrder[idx]`, calls `doAttach(id, btn)`.  
**Current:** no `metaKey` branch for digits anywhere. The tile popover's Attach action fires
only on right-click. Richard loses the keyboard path to iTerm-attach entirely.

### 4. Double-click attach removed
**Legacy:** lines 3077–3124 — each tile `btn.addEventListener('dblclick')` calls `doAttach(id,
btn)` and cancels the 220 ms single-click debounce.  
**Current:** `buildAgentTile` (line 1495) registers only `onClick` and `onContextmenu`; no
`dblclick` handler. The 220 ms debounce pattern is also absent, so a fast double-click fires
two `toggleAgent` calls instead of one attach.

### 5. Status-dot polling absent — dots are static grey on load
**Legacy:** lines 4905–4951 — `pollStatusOnce()` invokes `pane-status` IPC, updates
`dot.classList` with `on` / `detached` (yellow, 3s poll), starts `statusTimer = setInterval(tick,
3000)` on `startStatusPolling()`.  
**Current:** `status-dot` span is created (line 1499) but nothing ever calls `pane-status`,
nothing sets `.on` or `.detached`, and no interval is started. All dots stay grey
indefinitely regardless of tmux session state.

---

## High-priority gaps (operator-visible degradation, not blocking)

### 6. Edit mode is a placeholder — EDIT button has no body.editing behavior
**Legacy:** lines 266-343 (CSS for `body.editing`, `.badge`, `.remove-badge`,
`.confirm-overlay`), lines 4893-4898 (JS `toggleEditMode()`), lines 3087-3166 (badge
construction in `buildAgentTile` — `.remove-badge` × button + `.confirm-overlay` overlay).  
**Current:** EDIT button at line 1470 toggles `state.editOn` (a local boolean) and
`editBtnEl.classList.toggle('active')` only. No `body.editing` class is set; no badges are
built into tiles; no `confirm-overlay` exists; `remove-agent` IPC is never called. The title
attribute at line 1472 literally says "placeholder — registry editing not wired in this build."

### 7. Per-agent radial-settings panel (`auto_restart`, `rename_to`, `startup_slash`, detach) stripped
**Legacy:** lines 1788-2086 (CSS), lines 3958-4221 (JS `openSettingsPanel()`), HTML at line
2886. The gear orb in the radial fan opened a glass side-panel with: iOS-style `auto_restart`
toggle (IPC `update-agent` patch), `rename_to` text field (live label rewrite), `startup_slash`
text field, `detach-pane-to-window` / `detach-pane-to-split` buttons with flash feedback.  
**Current:** tile popover (`.tile-popover`, line 849) has CWD / ATTACH / RESTART / KILL but
no settings fields. `update-agent`, `detach-pane-to-window`, `detach-pane-to-split` IPCs are
entirely absent from the current IPC call list.

### 8. Session-layout poller and stop-session button absent
**Legacy:** lines 4617-4760 — `pollSessionLayoutOnce()` invokes `get-session-layout` IPC on
the same 3s tick as `pollStatusOnce`, drives the `.stop-session-btn` disabled/enabled state
and the layout-mismatch hint. `kill-session` IPC fires on confirm.  
**Current:** no `get-session-layout` or `kill-session` IPC calls, no `.stop-session-btn`
element, no session-layout state.

### 9. Esc priority stack is incomplete — voice-cancel leg missing
**Legacy:** three separate `window.addEventListener('keydown')` for Esc: radial (line 3844),
voice-cancel (line 5618), window blur guard (line 5640). Chat-overlay adds its own Esc
listener with `capture` on `document`.  
**Current:** single Esc handler (line 2321) covers add-overlay, tile-popover, and gear drawer.
No voice-cancel branch (harmless only because voice is also missing, but must be added alongside
voice restoration).

### 10. Window blur mid-hold guard absent
**Legacy:** lines 5640-5660 — `window.addEventListener('blur')` cancels quietly if
`voiceRec.state !== 'idle'`, preventing `mediaStream` / `audioCtx` leaks when Richard
Cmd+Tabs away during a hold.  
**Current:** `window.addEventListener('blur')` (line 2351) only closes the tile popover.

---

## Medium gaps (nice-to-have parity)

### 11. fkey-badge keycap visual replaced by plain agent-key label
**Legacy:** lines 363-408 — `.fkey-badge` is a distinct mechanical-keycap widget above the
avatar (stamp 1-9 by dock order, depress animation when that key is down, hidden in edit mode,
color-shifts red when recording). Built per-tile at legacy lines 3188-3198.  
**Current:** `agent-key` (line 137, 1496) renders the same label position but uses the agent's
`key` property (static text from registry), not the dock-position digit. No depress animation,
no recording color shift.

### 12. Voice transcript bubble has no analog for non-voice dictation feedback
**Legacy:** lines 496-568 — `.voice-transcript` positioned above the active tile showing live
SpeechRecognition interim text (target name + cursor blink) + permission-pending dim state.  
**Current:** action toast (line 591) covers generic confirmations but there is no equivalent
live-preview surface for mid-dictation feedback. The two surfaces (`action-toast` for actions,
`voice-toast` for send confirmation, `voice-transcript` for live preview) do not overlap — all
three must coexist.

### 13. Tile's single-click 220ms debounce against dblclick removed
**Legacy:** lines 3080-3104 — `_selectClickTimer` defers `toggleAgent` by 220ms so a
double-click doesn't flash the tile before `doAttach` fires.  
**Current:** `onClick: () => toggleAgent(a.key)` at line 1507 fires immediately. When dblclick
attach is restored (gap 4), the debounce pattern must come back with it, or every double-click
produces a select-flash before attach.

### 14. No-drag coverage is shallower in current layout
**Legacy:** lines 137-871 — explicit `-webkit-app-region: no-drag` on `.dock`, `.agent-btn`,
`.chat-row`, `.chat-input`, `.send-btn`, `.util-buttons`, and every interactive widget.  
**Current:** `body` is `drag` (line 28). `.panel-content`, `.panel-shell`, and most interactive
children have no `no-drag` declarations visible (only a few widgets carry it, e.g. line 122,
194, 316). The radial `overlayEl.shown` scoping fix from commit `df06cea` is implemented, but
the broader per-widget no-drag coverage from the legacy file is not fully ported.

---

## Intentionally stripped (do not restore)
- **Cmd+T team-chat overlay** — explicitly removed per design (legacy lines 2089-6342 JS,
  ~2700 lines); confirmed absent in current file with no matching selectors.
- **Deploy-preview confirmation overlay** — intentionally stripped per new deploy flow (legacy
  lines 1055-1186 CSS, 2818-2882 HTML, JS wiring); confirmed absent in current file.

---

## Restoration recommendations

**Gap 1 — Voice / Whisper stack:**  
Restore the `voiceRec` state machine object, `startVoiceRecording(idx, id)`,
`cancelVoiceRecording({shake})`, `finishVoiceRecording()`, and `showVoiceToast()` from the
legacy script block verbatim. Re-add CSS blocks `.voice-recording`, `.voice-recording-tile`,
`@keyframes voiceAurora`, `@keyframes voiceCancelShake`, `.voice-transcript`, `.voice-toast`
from legacy lines 395-628. Restore `#voice-toast` lazy-built DOM element. Wire the
`transcribe-voice` IPC invoke in `finishVoiceRecording`. Restore window-blur guard.

**Gap 2 — Number-key tap toggles correct agent:**  
Replace line 2335 `toggleAgent(e.key)` with the legacy `FKEY_MAP` / `fkeyAgentId(idx)` lookup
so tap uses dock-position order. Replace hard-coded 1-5 regex with 1-9 to match legacy range.
Once voice is restored this handler merges into the unified keydown/keyup state machine.

**Gap 3 — Cmd+digit attach:**  
Add a `window.addEventListener('keydown')` with `ev.metaKey` gate, digit 1-9 check, dock-order
lookup via `agentOrder[idx]`, and `doAttach(id, btn)` call. Input/edit-mode guards from legacy
lines 5021-5040 carry over directly.

**Gap 4 — Dblclick attach + 220ms debounce:**  
In `buildAgentTile`, wrap the existing `onClick` in a `_selectClickTimer` deferred 220ms, and
add `btn.addEventListener('dblclick', ...)` that clears the timer and calls `doAttach`. Cancel
the pending select on dblclick. Pattern is self-contained in legacy lines 3077-3124.

**Gap 5 — Status-dot polling:**  
Add `async function pollStatusOnce()` that invokes `pane-status` IPC and sets `dot.classList`
(`on` / `detached` / neither) per agent. Start `setInterval(pollStatusOnce, 3000)` after
`buildPanel()`. CSS for `.status-dot.on` (green pulse) and `.status-dot.detached` (amber,
`--status-detached` var) are missing from current file and must be added alongside.

**Gap 6 — Edit mode:**  
Add `body.editing` CSS rules (dashed tile borders, badge visibility, `fkey-badge` opacity-0).
Build `.remove-badge` (×) and `.confirm-overlay` into `buildAgentTile`. Implement
`toggleEditMode()` that toggles `document.body.classList` and calls `remove-agent` IPC from
the confirm path. Wire the existing EDIT button's `onClick` to `toggleEditMode()` instead of
the local `state.editOn` flag.

**Gap 7 — Per-agent radial/tile settings panel:**  
Either extend the existing `.tile-popover` with Settings entry that opens a side-panel, or
port `openSettingsPanel()` from legacy. Required IPC: `update-agent` (auto_restart, rename_to,
startup_slash patches), `detach-pane-to-window`, `detach-pane-to-split`. The legacy `radial-
settings` CSS block (lines 1799-2043) can be ported as-is; only the trigger changes from gear
orb to a gear icon in the tile popover.

**Gap 8 — Session layout / stop-session:**  
Add `pollSessionLayoutOnce()` invoking `get-session-layout` IPC on the same 3s tick as
`pollStatusOnce`. Add `.stop-session-btn` element with confirm pattern. Wire `kill-session` IPC
to confirmed click.

**Gaps 9 + 10 — Esc voice-cancel + window-blur guard:**  
These are zero-work side-effects of restoring the voice stack (gap 1) — both handlers come
back verbatim from the legacy block.

**Gap 11 — fkey-badge keycap:**  
Replace `.agent-key` with the legacy `.fkey-badge` CSS (lines 367-408) and the per-tile badge
construction at legacy lines 3188-3198. Populate with `tagFkeyBadges()` after dock render.

**Gap 12 — Voice transcript bubble:**  
Restore `.voice-transcript` CSS (legacy lines 496-568) and the lazy-built DOM element in
`showTranscriptBubble()` / `clearTranscriptBubble()` from the legacy script. Surface is
independent of `action-toast` and `voice-toast` — all three coexist at different z-levels.

**Gap 13 — Single-click debounce:**  
Implement `_selectClickTimer` pattern in `buildAgentTile` as described in gap 4.

**Gap 14 — No-drag coverage:**  
Audit every interactive widget in `.panel-content` and add `-webkit-app-region: no-drag` to
`.dock`, `.agent-tile`, `.chat-input`, `.chat-wrap`, `.send-btn`, `.util-cluster`, `.util-btn`,
and the add-overlay backdrop. Reference legacy lines 137-871 for the complete list.
