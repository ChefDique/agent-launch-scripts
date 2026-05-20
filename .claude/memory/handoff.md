# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote quality-control checkpoint: root task board, PRD/feature index/quality gates, and regression fixes.

**State at last pause (2026-05-19T22:29:42-0700):**
- Created root `tasks.json` and docs artifacts: `docs/product/agentremote-prd.md`, `docs/product/agentremote-feature-index.md`, and `docs/operations/agentremote-quality-gates.md`.
- Fixed current repo-side regressions with static/isolated tests only: catalog-backed model/reasoning picker, Claude-only `startup_injection`, no Codex blank Enter injection, image paste submit path, Option-key terminal word editing, literal tmux send path, safer marked iTerm viewer script, and docs integrity.
- Global Neo `PreToolUse` guard is installed in `~/.codex/hooks.json`; `bash scripts/audit-codex-lifecycle-hooks.sh` passes with `warnings=0`.
- Review found and fixes were applied for two late bugs: settings profile rename now uses `update-agent-form`, and Claude startup literal lines use `tmux send-keys -l --`.
- No live AgentRemote/iTerm/tmux attach/deploy/stop/layout or AppleScript verification has been run in this checkpoint.

**Next verifiable step:** Run the full safe suite after chores edits, then commit the checkpoint if green.

**If that step fails:** Fix the failing test before committing. Do not run live AgentRemote/iTerm/tmux checks unless Richard explicitly approves that exact live mutation.

**Pending uncommitted diff:** Large repo-local checkpoint across root docs/tasks, launcher, lifecycle hooks, AgentRemote app/tests, and package version `1.4.12`; no cross-repo edits. Global hook file changed outside repo: `~/.codex/hooks.json`.

## Open priorities

- [REVIEW] **ALS-QUALITY-004 current fixes** — safe tests must remain green after chores edits, then commit checkpoint.
- [BLOCKED] **ALS-QUALITY-007 live AgentRemote verification** — requires Richard approval before mutating live AgentRemote/iTerm/tmux.
- [BLOCKED-SWARMY] **Unsupported `gpt-5.1` worker launches** — Swarmy owns model selection/defaults and worker-completion proof.
- [WAIT] **AgentRemote Deploy live proof** — repo has static/isolated viewer safety coverage, but live attach/layout/pane naming remains approval-gated.

## Cross-session comms

- 2026-05-19 Neo -> Swarmy: reported unsupported `gpt-5.1` Codex worker launch and missing pane/window names; asked Swarmy to fix in its own repo and coordinate by PR/worktree, not by editing `agent-launch-scripts`.

<!-- Mirror of the current repo-local handoff in memory/handoff.md. Do not move memory folders. -->
