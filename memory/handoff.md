# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Shipped the startup-warning auto-dismiss (Claude default-on in `launch-agent.sh`) + a per-agent "Startup auto-run" HUD toggle (v1.4.16); retired `tmux-masta`→`neo` repo-wide. Opus-Neo, 2026-05-21.

**State at last pause (2026-05-21T13:47:00-0700):**
- ORIGINAL PROBLEM SOLVED: Claude agents auto-dismiss the dev-channels warning on launch/restart — warning-ack now **defaults ON** for Claude unless explicitly excluded (`launch-agent.sh`). Covers dasha + future Claude agents without per-agent wiring. Commit `80128ea`.
- SWITCH DELIVERED (the thing Richard kept asking for): per-agent **"Startup auto-run"** toggle in the HUD gear panel (Claude agents), ON=inject / OFF=suppress. v1.4.16, commit `76ebc52`. Tests 145/145.
- RENAME: `tmux-masta`→`neo` everywhere (docs/memory/tests/hook/assets; `agent-notes/neo.md`). Commit `acd7d10`.
- NOT pushed. `agents.json` left dirty on purpose — Richard's active registry edit (incl. dasha=claude); do not commit it.
- METHOD MISS (recurring): Richard set "first of all what problem are you trying to solve" as a diagnose-BEFORE-build gate; I built first repeatedly. Lesson logged in [[neo]] agent-notes. Honor the gate next time.

**Next verifiable step:** PAUSED per Richard (2026-05-21). The diagnose-before-build goal-gate was unsatisfiable retroactively (build had already happened) and Richard cleared it; he then set goal = pause. On resume: relaunch the HUD to confirm the v1.4.16 "Startup auto-run" toggle renders; push the commits only when Richard asks.

**If that step fails:** toggle lives in `remote-app/index.html` (gear settings panel, the toggle-row after auto-restart) wired via `update-agent` PATCH; check the renderer console for a JS error in that block.

**Pending uncommitted diff:** `agents.json` only (Richard's edit).

## Open priorities (<=5)

- [OPEN] **Cross-pane extra CRs from Shift+Return** — iTerm Broadcast Input hypothesis rejected by Richard; cause unconfirmed, he moved on. See [[project_iterm_broadcast_extra_cr]].
- [REVIEW-PENDING] **ALS-LOCAL-001 image paste** — live check owed; uses `[image:/path]` text ref, NOT OSC 1337.
- [BLOCKED-SWARMY] **ALS-QUALITY-005 unsupported Codex model worker launches** — Swarmy-owned.
- [PARTIAL] **ALS-QUALITY-007 live AgentRemote verification** — send/submit verified; paste/attach/voice still need approved live checks.
- [FOLLOWUP] **HUD-managed non-Claude startup injection** — `applyRuntimePolicy` strips `startup_injection` from non-Claude on UI-edit; only lift if Codex HUD injection is wanted.

## Cross-session comms

- None outstanding.
