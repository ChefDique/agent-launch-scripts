# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** Global Codex lifecycle hook system.

**State at last pause (2026-05-20T05:38:00Z):**
- Extended `scripts/codex-lifecycle-hook.sh` into one repo-owned hook system: startup/status artifact validation, `SessionStart` checkpoint context, `PreToolUse` mutation gate, `PreCompact` stale-status/process blocks, `Stop` continuation for unfinished active work, and non-destructive process tracking.
- Added `memory/session-status.json` as the artifact-backed status source for this lane. Reporting should come from that file where possible, not model memory.
- Updated `scripts/audit-codex-lifecycle-hooks.sh` with dry-run coverage for startup/status proof, stale handoff checksum, Stop continuation, process cleanup block, cross-repo/live-surface guards, and source model rejection.
- Updated `docs/operations/codex-lifecycle-hooks.md` with hard-enforced vs not-enforced behavior, no `UserPromptSubmit`, process cleanup contract, and sources checked.
- Wrote operator handoff: `memory/sessions/2026-05-20_0538_global-codex-hook-system.md`.
- Verification passed: `bash -n scripts/codex-lifecycle-hook.sh scripts/audit-codex-lifecycle-hooks.sh`; `bash scripts/audit-codex-lifecycle-hooks.sh` (pass, warnings=0); `bash test/launch-agent-runtime.test.sh`; `npm --prefix remote-app run test:policy`; focused `git diff --check`.

**Next verifiable step:** Watch the next fresh Codex startup/compaction/stop cycle and confirm it reads `memory/session-status.json` as the reporting source.

**If that step fails:** Keep `UserPromptSubmit` unwired and rely on the artifact-backed `PreToolUse` gate; do not add prompt injection as a workaround.

**Pending uncommitted diff:** Existing dirty AgentRemote/launcher checkpoint work remains in the checkout. This hook pass intentionally touched only lifecycle hook, audit, docs, and memory/status handoff files.

## Open priorities (<=5)

- [DONE] **Global Codex lifecycle hook system** — hook/audit/docs/status artifact implemented and verified; live audit now passes with `warnings=0`.
- [REVIEW] **ALS-QUALITY-004 current fixes** — safe tests must remain green after chores edits, then commit checkpoint.
- [BLOCKED] **ALS-QUALITY-007 live AgentRemote verification** — requires Richard approval before mutating live AgentRemote/iTerm/tmux.
- [BLOCKED-SWARMY] **Unsupported `gpt-5.1` worker launches** — Swarmy owns model selection/defaults and worker-completion proof.
- [WAIT] **AgentRemote Deploy live proof** — repo has static/isolated viewer safety coverage, but live attach/layout/pane naming remains approval-gated.

## Cross-session comms

- 2026-05-19 Neo -> Swarmy: reported unsupported `gpt-5.1` Codex worker launch and missing pane/window names; asked Swarmy to fix in its own repo and coordinate by PR/worktree, not by editing `agent-launch-scripts`.
