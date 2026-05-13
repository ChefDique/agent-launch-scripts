# AgentRemote v1 Pivot Plan — Operator HUD First, Council Next

**Status:** Plan Initiation / Pivot Directive. Greenlit by Richard 2026-05-03.

## Authority

This document is the working pivot directive for AgentRemote v1.

AgentRemote is now scoped as Richard's **trusted local operator HUD** for spawning, supervising, attaching, broadcasting to, and coordinating the permanent local agent fleet. It is **not** ACRM, **not** Atlas, and **not** the canonical Swarmy worker-spawn runtime.

Read order before implementation:

1. `CLAUDE.md` — operating role, fleet model, launch responsibilities.
2. `DESIGN.md` — AgentRemote product boundary, design primitives, migration target.
3. `remote-app/index.html` — current Electron HUD implementation and actual UI state.
4. `agents.json` — local fleet registry.
5. `chq-tmux.sh` — canonical tmux orchestration and layout behavior.
6. `launch-agent.sh` — per-agent launcher and auto-inject sequence.
7. `COUNCIL.md` — Council v0, but only after the layout/state/process fixes below are understood.

## Pivot

Do not start by adding more UI. First make the existing HUD truthful, safe, and internally consistent.

Priority order:

1. Fix `MULTI` / `ittab` layout truth.
2. Resolve `tiled` mode inconsistency.
3. Fix settings popover clipping. **Code fixed in remote-app v1.4.4; needs Richard live verification.**
4. Patch chat optimistic-send correlation bug.
5. Update stale voice-recording backlog notes.
6. Deprecate or fix legacy remotes.
7. Harden broad process-kill and shell-string footguns.
8. Refactor renderer enough that Council v0 does not become another monolithic patch.
9. Then implement Council foundation: JSONL envelope, council spawner, sentinel-gated router, Councils tab, `/council`, `/disperse`.

## P0 — Layout truth (priorities 1–2)

**1. `MULTI` / `ittab` layout truth.**
Renderer's `effectiveLayout()` in `remote-app/index.html` maps `PANES + MULTI=on` → `'tiled'` (still a split-pane grid in one window) and `WINDOWS + MULTI=on` → `'ittab'` (one iTerm window per agent). The user reads the MULTI pill as "give me separate movable windows" and is hitting the wrong quadrant. **Fix:** rewire so MULTI alone implies `ittab` (separate windows). Either drop the PANES/WINDOWS toggle entirely or make MULTI override both. Source: ALS-002 infra audit, `tasks/ALS-002-infra-audit.md` Complaint 1.

**2. `tiled` mode inconsistency.**
Per `chq-tmux.sh` `cmd_start` line 230, `tiled` and `panes` both go through `split-window -h` then a `select-layout tiled` re-balance — `tiled` is just `panes` with auto-arrangement. The renderer treats them as distinct user-visible modes; the bash treats them as near-aliases. **Fix:** either hide `tiled` from the renderer or document that `tiled` = `panes` + auto-balance and adjust the pill labels.

## P0 — Process + state truth (priorities 7, 4, 6)

**7. Process-kill + shell-string footguns.**
`main.js`'s `kill-pane` handler at line 885 uses `execFile` (good — already argv'd). But the silent-fail path at line 913 returns a soft toast when `listPanes()` doesn't find a coord match for the agent (stale pane-status after rename or layout change), and the user never knows the kill didn't fire. **Fix:** harden the guard — re-resolve pane by `paneId` if `coord` lookup fails, or surface a hard error to the renderer instead of a soft toast. Plus: audit every `execFile` call site for argv consistency (the broadcast handler at line 454 already does it correctly; verify the others).

**4. Chat optimistic-send correlation.**
The post-port `doSend()` fires a toast immediately and clears the input regardless of whether the IPC actually delivered. If `broadcast-message` finds zero matching panes (because the agent renamed/restarted between selection and send), the message vanishes silently. **Fix:** `ipcRenderer.invoke('broadcast-message', ...)` instead of `.send(...)`, await the count of panes that actually received the keys, and toast `SENT → N` with the real N — or surface an error if zero.

**6. Deprecate or fix legacy remotes.**
`agent-remote.py` (Tkinter), `remote-control.swift` (NSPanel), `remote-toolkit.sh` (osascript), `term-remote.sh` (terminal menu) — all four still ship. The Electron HUD is the canonical surface; the others are unmaintained alternates that confuse "is X a current path or dead code?" for any future agent. **Fix:** move to `deprecated/` (already exists per recent commits) or delete outright — Richard's call. CLAUDE.md should name a single canonical remote.

## P1 — UI truth (priorities 3, 5)

**3. Settings popover clipping.**
The gear drawer is positioned `fixed` and absolute-positioned within the BrowserWindow. With the window at 820×280, the drawer's max-height of 70vh = ~196px is too cramped, and on multi-monitor setups the popover can hit the screen edge. **Fix:** either grow the BrowserWindow when the drawer opens (already attempted via `resize-window` IPC — verify it's not capped by `Math.min(1200, ...)` at `main.js:342`), or open the drawer in a separate child BrowserWindow that can extend past the panel. The latter is the cleaner long-term answer.

2026-05-13 update: v1.4.4 keeps the inline drawer path, but changes it to measure natural settings height, ask Electron to resize, then position from the post-resize visible height so display caps fall back to the dark internal scrollbar instead of cutting off the bottom. The avatar cropper opened from settings also requests HUD growth. The dock now uses a fixed nine-column grid to avoid the persistent seven-column wrap void.

**5. Voice-recording backlog notes.**
`CLAUDE.md` "Outstanding for AgentRemote" still names voice as broken — Web SpeechRecognition was swapped to local Whisper at commit `95879e7` and the legacy renderer wired hold-key-1-5 to that flow. The post-port renderer dropped the wiring entirely. **Fix:** restore hold-key-1-5 → `getUserMedia` → `MediaRecorder` → `transcribe-voice` IPC (handler at `main.js:388` is intact) → `broadcast-message` to that single agent. Reference legacy implementation at `git show 7931e16:remote-app/index.html` lines 357–619 (audit-team is enumerating the exact set).

## P1 — Foundation (priority 8)

**8. Renderer refactor before Council v0.**
The post-port `remote-app/index.html` is 1611 lines, single-file, with `state` as a flat object and DOM mutations scattered. Adding the Council tab + JSONL transcript view + per-council subtabs on top of this monolith will land another 600–1000 lines and make every future change a needle-in-haystack edit. **Fix:** before COUNCIL.md T4 ships, factor the renderer into modules (panel, dock, chat, util-row, drawer, voice, council). Use a build step or split via separate `<script>` tags (Electron's `nodeIntegration: true` allows multiple scripts to share globals). Aim for ≤300 lines per concern.

## P2 — Council v0 (priority 9)

Once 1–8 are landed: implement Council v0 per `COUNCIL.md`. T1 is shipped (Swarmy, PR ChefDique/message-agent#6 merged 2026-05-03); T2 (spawner) was paused per architecture shift toward inbox-driven multi-writer (Lucius eval R&D commit `cbc4fad`). Re-confirm T3/T4 architecture before T2 ships — sentinels may be vestigial. See `tasks/ALS-001` notes for the architecture-shift context.

## ACRM tracking

| Task | Priority | Status |
|---|---|---|
| ALS-001 — post-port rewiring (voice/keybindings/gradient/overlap) | P0/P1 mix | in_progress (paused; in-flight stash on main) |
| ALS-002 — regression audit (renderer + infra) | P0 | in_progress (Sonnet evaluators dispatched 2026-05-03) |
| ALS-003 — fixes from audit findings | P0 | not yet filed (pending audit completion) |
| ALS-004 — `MULTI` semantics fix | P0 | not yet filed |
| ALS-005 — chat send correlation | P0 | not yet filed |
| ALS-006 — kill-pane guard hardening | P0 | not yet filed |
| ALS-007 — legacy remote cleanup | P0 | not yet filed |
| ALS-008 — drawer overflow / window strategy | P1 | not yet filed |
| ALS-009 — renderer refactor pre-Council | P1 | not yet filed |
| Council T2 (paused) | P2 | dependency: Phase 0 inbox primitive landing |

## Handoff line for dispatched agents

Use this exact preamble at the top of any agent brief that touches AgentRemote files:

```
Read docs/exec-plans/active/agentremote-v1-pivot-plan.md first. Do not implement new Council UI
until the P0 AgentRemote layout/state fixes are complete. AgentRemote v1 is the
trusted local operator HUD; keep Swarmy worker-runtime concerns separate unless
explicitly assigned.
```

## Out of scope for this plan

- Atlas-of-Atlas-Island agent rollout — separate session post-pivot, ARB-003/004/008/009 in CorporateHQ.
- ACRM iso-roomgrid spike — Xavier-driven, validated 2026-05-02.
- VoiceType menu-bar product — sister project, independent codebase.
- Fluid / Holo / audio-reactivity backgrounds — deferred per design docs.
