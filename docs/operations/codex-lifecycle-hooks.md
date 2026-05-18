# Codex Lifecycle Hooks

## Purpose

Codex lead sessions need the same lifecycle pressure as Claude sessions:

- `/chores` after a major task completes, fails, or hits a real blocked path.
- `/done` at final session closeout.
- Session logs and handoff state updated before the agent moves to the next large task.

The repo-owned implementation is:

```text
scripts/codex-lifecycle-hook.sh
scripts/audit-codex-lifecycle-hooks.sh
```

## Behavior

`scripts/codex-lifecycle-hook.sh` emits hook `additionalContext`; it does not
run `/chores` or `/done` itself.

It nudges on three conservative signals:

- `PostToolUse`: all `plan` or `todos` entries are `completed`.
- `PostToolUse`: repeated shell/tool failures in one cwd. Default threshold is
  `CODEX_LIFECYCLE_FAILURE_THRESHOLD=2`.
- `UserPromptSubmit`: closeout or failure language such as `/done`, `closeout`,
  `task complete`, or `task failed`.

`Stop` is quiet by default because Codex stop events do not prove the session is
actually ending. Set `CODEX_LIFECYCLE_STOP_NUDGE=1` only when you explicitly
want a final reminder if a prior completion/failure signal is pending.

## Codex Wiring

The live Codex feature flag is global:

```text
~/.codex/config.toml
```

The live hook registry is global:

```text
~/.codex/hooks.json
```

This repo owns the hook script and audit. It does not silently edit the global
hook registry from normal agent work. To install the hook globally, add entries
like this to `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "update_plan|TodoWrite",
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event PostToolUse"
          }
        ]
      },
      {
        "matcher": "Bash|Shell|exec_command|functions.exec_command",
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event PostToolUse"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event UserPromptSubmit"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event Stop"
          }
        ]
      }
    ]
  }
}
```

If existing hooks are present, merge the entries instead of replacing them.

## Verification

Run:

```bash
bash scripts/audit-codex-lifecycle-hooks.sh
```

The audit checks:

- hook script exists and parses,
- `~/.codex/config.toml` enables Codex hooks,
- `codex features list` reports `hooks=true`,
- `~/.codex/hooks.json` parses,
- the global hook registry references this repo-owned hook script,
- completion and failure dry-run samples emit lifecycle checkpoints.

By default, a missing global reference is a warning because this repo should not
mutate the operator's global Codex config without explicit intent. Use
`STRICT_CODEX_LIFECYCLE_HOOKS=1` to make that warning fail the audit.

## Limitation

Codex hooks can observe submitted prompts and tool events. They cannot reliably
infer that a human-visible session is truly over unless the agent invokes
`/done` or the launcher/AgentRemote closeout path runs. Treat the hook as a
guardrail, not the lifecycle source of truth. The source of truth remains:

```text
/Users/richardadair/.agents/skills/chores/SKILL.md
/Users/richardadair/.agents/skills/done/SKILL.md
memory/handoff.md or .claude/memory/handoff.md in the active repo
```
