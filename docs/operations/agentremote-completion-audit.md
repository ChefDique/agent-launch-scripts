# AgentRemote Completion Audit

Updated: 2026-05-19T23:25:45-0700

This audit prevents Neo from treating a green commit, a green test suite, or a
hook recommendation as the end of Richard's goal. The goal stays active until
every requested surface is either verified complete or explicitly blocked by an
approval or another repo owner.

## Success Criteria From Richard's Prompt

| Requirement | Artifact / evidence | Current state |
|---|---|---|
| Replace `tmux-masta.md` wording with Neo while preserving the stable id. | `AGENTS.md`, `memory/agent-notes/tmux-masta.md`. | Done. Visible lane name is Neo; stable registry id remains `tmux-masta` for compatibility. |
| Do not change the memory folder location. | `memory/` remains the repo-local handoff/session/status folder; `.claude/memory/handoff.md` is only mirrored because startup reads it first. | Done. No memory relocation. |
| Consolidate and improve codebase architecture. | `docs/product/agentremote-prd.md`, `docs/product/agentremote-feature-index.md`, `docs/operations/agentremote-quality-gates.md`, `tasks.json`, lifecycle-hook docs. | Done for documentation/control-plane architecture; live runtime architecture remains approval-gated for desktop checks. |
| Legit model and thinking-level selection. | `remote-app/config/harness-models.json`, `remote-app/harness-models.js`, `launch-agent.sh`, `remote-app/test/harness-models.test.js`, `test/launch-agent-runtime.test.sh`, renderer static tests. | Done for Codex local catalog/config/env choices and safe Codex model validation. The picker reads `~/.codex/models_cache.json`, keeps the configured GPT fallback list, labels the Codex control as `thinking level`, and exposes/passes `xhigh` as `model_reasoning_effort="xhigh"`. No remote ChatGPT/Claude web feed is implemented. |
| Stop blank carriage returns / Claude startup Enter sabotaging Codex. | `launch-agent.sh`, `test/launch-agent-runtime.test.sh`, `docs/operations/agentremote-quality-gates.md`. | Done in static launcher coverage: startup injection is policy-gated and Claude opt-in only. Live spawn proof requires approval. |
| Add include/exclude field/check behavior for startup injection. | `launch-agent.sh` registry policy handling; launcher tests. | Done. `startup_injection.include` / `exclude` gate startup lines and dangerous-permission Enter. |
| Fix image paste into Codex chats. | `remote-app/index.html`, `remote-app/tmux-send-path.js`, `remote-app/test/tmux-send-path.integration.test.js`, renderer static tests. | Done in renderer/static and isolated tmux tests. Live Codex pane proof requires approval. |
| Restore Option-arrow / word-delete keyboard shortcuts. | `remote-app/terminal-input.js`, `remote-app/main.js`, `remote-app/test/terminal-input.test.js`. | Done in shared terminal-input tests and renderer wiring. Live viewer proof requires approval. |
| Do not mutate live iTerm/tmux/AgentRemote while testing. | `docs/operations/agentremote-quality-gates.md`, lifecycle hook live-surface guard. | Done. Safe tests only; no live PASS claimed. |
| Create a root task list. | `tasks.json`. | Done. Remaining rows are blocked, not forgotten. |
| Build PRD/features/index/docs so future sessions stop forgetting app requirements. | `docs/product/agentremote-prd.md`, `docs/product/agentremote-feature-index.md`, `docs/README.md`, `AGENTS.md`. | Done. Docs are linked from startup/read-order surfaces. |
| Use hooks so chores/status discipline is not ignored. | `scripts/codex-lifecycle-hook.sh`, `scripts/audit-codex-lifecycle-hooks.sh`, `docs/operations/codex-lifecycle-hooks.md`, `~/.codex/hooks.json`. | Done. The global hook registry now wires SessionStart, PreToolUse, PostToolUse, PreCompact, PostCompact, and Stop. |
| Actually do chores, not recommend them. | `memory/handoff.md`, `.claude/memory/handoff.md`, `memory/session-status.json`, `memory/sessions/2026-05-19_2229_agentremote-quality-control-checkpoint.md`, `memory/sessions/2026-05-20_0538_global-codex-hook-system.md`. | Done this checkpoint. |
| Coordinate with Swarmy instead of editing Swarmy. | message-agent thread/deadletter; `tasks.json` ALS-QUALITY-005. | Blocked outside this repo. Neo attempted Swarmy delivery and did not patch Swarmy. Latest send to `overlordswarmy` failed with connection refused; message-agent wrote deadletter and alerted Mugatu. |
| Do not mark the goal complete while live AgentRemote verification is missing. | `tasks.json` ALS-QUALITY-007; this audit. | Blocked. Live verification requires Richard approval for desktop mutation. |
| Stop resetting/turning off the goal prematurely. | `memory/session-status.json`, `memory/handoff.md`, `scripts/codex-lifecycle-hook.sh`, `scripts/audit-codex-lifecycle-hooks.sh`, live `/goal` state. | Enforced and still not complete. The status artifact is `status=blocked`, handoff says not to mark complete while ALS-QUALITY-005/007 remain blocked, the live goal tool is `active`, and `Stop` dry-run emits `STOP LIFECYCLE CONTINUATION` for the blocked state. |

## Fresh Verification

- `get_goal` - live goal status is `active`; not marked complete.
- `shasum -a 256 memory/handoff.md memory/tasks/tasks.json` - matches `memory/session-status.json` handoff and taskboard hashes.
- `printf '{"cwd":"...","stop_hook_active":false}' | scripts/codex-lifecycle-hook.sh --event Stop --dry-run` - emits `STOP LIFECYCLE CONTINUATION` with `status=blocked`.
- `bash scripts/audit-codex-lifecycle-hooks.sh` - pass, `warnings=0`.
- `npm --prefix remote-app test` - pass, 136 tests plus shell subtests.
- `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh scripts/session-end-cleanup.sh scripts/codex-lifecycle-hook.sh scripts/audit-codex-lifecycle-hooks.sh` - pass.
- `bash test/launch-agent-runtime.test.sh` - pass.
- `bash test/chq-codex-runtime-smoke.test.sh` - pass.
- `jq . tasks.json`, `jq . agents.json`, `jq . ~/.codex/hooks.json`, `jq . memory/session-status.json` - pass.
- `git diff --check` - pass.

## Completion Decision

Do not call `update_goal(status=complete)` yet. The premature-reset guard is
working, but the guarded AgentRemote goal remains blocked by unresolved live
verification and Swarmy-owned runtime proof. A blocked goal is not a completed
goal.

## Not Complete / Still Blocked

- **Live AgentRemote desktop proof:** blocked until Richard explicitly approves
  live AgentRemote/iTerm/tmux mutation in the current turn.
- **Swarmy unsupported Codex model/default issue:** blocked in Swarmy. Neo owns
  the local AgentRemote catalog/launcher guards only. Latest message-agent
  send to `overlordswarmy` failed transport with deadletter thread
  `neo-codex-to-overlordswarmy-1779255895`. Fallback coordination pointer to
  `mugatu-codex` was accepted with thread
  `neo-codex-to-mugatu-codex-1779256168`.
- **Global hooks file:** fixed in `~/.codex/hooks.json`, which is outside this
  repo and therefore not part of the Git commit.
