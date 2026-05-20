# Global Codex Hook System Handoff

## Plain-English State

The repo now has one lifecycle hook surface instead of a pile of one-off text guards. The hook requires a repo-local startup/status artifact before mutating work, continues Stop when active work is still recorded, blocks PreCompact when handoff/status/process proof is stale, and tracks cleanup-relevant processes without killing them blindly.

## Files Changed

- `scripts/codex-lifecycle-hook.sh` - added `SessionStart`, startup/status artifact validation, unfinished-work Stop continuation, process tracking, and process cleanup proof checks.
- `scripts/audit-codex-lifecycle-hooks.sh` - added dry-run coverage for startup/status proof, Stop continuation, stale handoff checksum, process cleanup blocks, and SessionStart wiring visibility.
- `docs/operations/codex-lifecycle-hooks.md` - documents hard enforcement, hook limitations, no `UserPromptSubmit`, process cleanup contract, source-system model routing, and source references.
- `memory/session-status.json` - new artifact-backed status file for this repo/lane.

## Hard vs Soft

Hard-enforced by hooks: mutating work waits for startup/status proof; cross-repo and live tmux/iTerm/AgentRemote mutations are blocked in guarded lanes; PreCompact blocks stale startup/status or unkept tracked processes; Stop continues unfinished work.

Not hard-enforced: exact chat phrasing, model cognition, every possible tool path, and bad model/provider selection. Model/provider rejection belongs in `launch-agent.sh`, `agents.json`, and `remote-app/config/harness-models.json`.

## Proof Run

- `bash -n scripts/codex-lifecycle-hook.sh scripts/audit-codex-lifecycle-hooks.sh` - pass.
- `bash scripts/audit-codex-lifecycle-hooks.sh` - pass, warnings=0.
- `bash test/launch-agent-runtime.test.sh` - pass.
- `npm --prefix remote-app run test:policy` - pass, 43 tests.
- `git diff --check -- scripts/codex-lifecycle-hook.sh scripts/audit-codex-lifecycle-hooks.sh docs/operations/codex-lifecycle-hooks.md memory/session-status.json` - pass.

## Remaining Operator Follow-Up

The live global `~/.codex/hooks.json` wires this repo-owned hook for `SessionStart`, `PreToolUse`, `PostToolUse`, `PreCompact`, `PostCompact`, and `Stop`, and intentionally has no `UserPromptSubmit`. No remaining repo-side blocker was found.
