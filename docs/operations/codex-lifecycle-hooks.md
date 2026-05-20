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
memory/session-status.json
```

## Behavior

`scripts/codex-lifecycle-hook.sh` emits hook `additionalContext` for lifecycle
reminders and emits hook `decision: "block"` only for preconditions it can
verify mechanically. It does not run `/chores` or `/done` itself.

It blocks or nudges on conservative signals:

- `SessionStart`: emits a startup/lane checkpoint that points at the required
  session status artifact. This is context only; the hard gate is `PreToolUse`.
- `PreToolUse`: for Neo/Codex (`MESSAGE_AGENT_IDENTITY=neo-codex` or
  `tmux-masta`), refuses file edits outside this repo and refuses live
  AgentRemote/iTerm/tmux mutations. The explicit operator override is
  `CODEX_LIFECYCLE_OPERATOR_OVERRIDE=1`; use it only when Richard has approved
  that specific cross-repo or live desktop action.
- `PreToolUse`: refuses mutating file tools in the guarded repo until
  `memory/session-status.json` exists and proves startup alignment: repo/lane,
  active goal, status, next action, and either handoff path + sha256 + read time
  or an explicit absent-handoff reason.
- `PostToolUse`: all `plan` or `todos` entries are `completed`.
- `PostToolUse`: repeated shell/tool failures in one cwd. Default threshold is
  `CODEX_LIFECYCLE_FAILURE_THRESHOLD=2`.
- `PostToolUse`: if a shell command appears to leave a dev/watch/browser/temp
  process behind, records it under `~/.codex/lifecycle-hooks` and asks for
  cleanup or an explicit `keep_running_processes` entry.
- `PreCompact`: tells the agent to run `/chores` when current work changed
  state, update the repo handoff, preserve the running todo list, and record
  blockers before compaction.
- `PreCompact`: blocks when the startup/status artifact is missing/stale, or
  when tracked cleanup-relevant processes are still live without keep-running
  proof.
- `PostCompact`: re-anchors the resumed agent on repo-relative
  `memory/handoff.md` (or `.claude/memory/handoff.md` fallback) by injecting the
  active handoff excerpt.
- `PreCompact`: if a Neo/Codex lifecycle event is running from outside this
  repo, it blocks compaction instead of anchoring lifecycle work to the wrong
  repo.
- `PostCompact` and `Stop`: if a Neo/Codex lifecycle event is running from
  outside this repo, it emits guard context. `PostCompact` is already after the
  boundary, so the hook re-anchors rather than pretending it can prevent the
  compact.

`Stop` continues the agent when `memory/session-status.json` still records
active unfinished work or when tracked cleanup-relevant processes are still live
without keep-running proof. It avoids infinite loops by not repeating the
continuation when Codex reports `stop_hook_active=true`. Set
`CODEX_LIFECYCLE_ALLOW_UNFINISHED_STOP=1` only for an explicit operator
override.

`UserPromptSubmit` intentionally stays unwired. Prompt-path hooks created too
much duplicate lifecycle noise and made Richard's messages harder to read.

## Session Status Artifact

The default artifact is:

```text
memory/session-status.json
```

Fallbacks are `.claude/memory/session-status.json` and
`.codex/session-status.json`. A minimal valid artifact is:

```json
{
  "repo_root": "/Users/richardadair/ai_projects/agent-launch-scripts",
  "lane": "hook-system",
  "active_goal": "Install a global Codex lifecycle hook system",
  "status": "in_progress",
  "next_action": "Run the lifecycle hook audit",
  "updated_at": "2026-05-20T00:00:00Z",
  "handoff": {
    "path": "memory/handoff.md",
    "sha256": "<sha256 of current handoff>",
    "read_at": "2026-05-20T00:00:00Z"
  },
  "keep_running_processes": [
    {
      "pid": 12345,
      "reason": "local preview Richard asked to keep open",
      "path": "/Users/richardadair/ai_projects/agent-launch-scripts",
      "owner": "neo-codex"
    }
  ]
}
```

If a repo really has no handoff file, use:

```json
{
  "handoff": {
    "absent_reason": "No repo handoff exists yet; startup checked README and AGENTS.md instead."
  }
}
```

Status reports should be generated from this artifact whenever possible. Hooks
cannot enforce exact chat wording, but they can block mutation, compaction, and
stop continuation when the artifact is missing or stale.

## Process Cleanup Contract

The hook does not kill processes. It snapshots suspicious shell commands before
execution and records new matching processes after execution. At `PreCompact`
and `Stop`, live tracked processes must be either:

- stopped by the agent, or
- listed in `keep_running_processes` with `pid`, `reason`, `path`, and `owner`.

This intentionally favors proof over blind cleanup. A browser/dev/watch process
that Richard asked to keep running should be recorded; an accidental temp
server should be stopped before closeout.

## Hard-Enforced vs Not Enforced

Hard-enforced where Codex hook semantics support it:

- `PreToolUse` deny for mutating work before startup/status proof.
- `PreToolUse` deny for cross-repo writes from a guarded lane.
- `PreToolUse` deny for live AgentRemote/iTerm/tmux mutation unless explicitly
  overridden.
- `PreCompact` deny for missing/stale status proof or unkept tracked processes.
- `Stop` continuation for unfinished status or unkept tracked processes.

Not hard-enforced by hooks:

- Exact prose in Richard-facing status messages. The enforceable object is the
  status artifact.
- Every possible tool path. Codex docs describe hooks as a guardrail, not a
  complete enforcement boundary.
- Whether the model truly understood a handoff. The artifact proves file path,
  checksum, and declared read time; it cannot prove cognition.
- Bad model/provider selection. That belongs in `launch-agent.sh`,
  `agents.json`, and `remote-app/config/harness-models.json`, where this repo
  already rejects unsupported Codex models before launch.

## Sources Checked

- Official OpenAI Codex hooks docs:
  `https://developers.openai.com/codex/hooks`
- OpenAI Codex releases noting stable/global hook support and newer lifecycle
  events:
  `https://github.com/openai/codex/releases`
- Public example pattern for a user-level Codex hook bundle:
  `https://github.com/shanraisshan/codex-cli-hooks`
- Local skills referenced for this design:
  `agent-governance`, `agent-team-orchestration`, `agent-self-improving`, and
  `agent-sandbox-conformance`.

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
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event SessionStart"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash|Shell|exec_command|functions.exec_command|Write|Edit|MultiEdit|apply_patch|functions.apply_patch",
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event PreToolUse"
          }
        ]
      }
    ],
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
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event PreCompact"
          }
        ]
      }
    ],
    "PostCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /Users/richardadair/ai_projects/agent-launch-scripts/scripts/codex-lifecycle-hook.sh --event PostCompact"
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
- the global hook registry references this repo-owned hook script for
  `PostToolUse`, `PreCompact`, `PostCompact`, and `Stop`,
- `SessionStart` is wired to the startup/lane checkpoint, as a warning by
  default and a failure with `STRICT_CODEX_LIFECYCLE_HOOKS=1`,
- `PreToolUse` is wired to the Neo/Codex scope guard, as a warning by default
  and a failure with `STRICT_CODEX_LIFECYCLE_HOOKS=1`,
- `UserPromptSubmit` remains unwired,
- completion, failure, startup/status artifact, stop-continuation,
  pre-compact, post-compact, cross-repo edit, missing status proof, process
  cleanup, live-surface mutation, and explicit override dry-run samples behave
  as expected,
- launcher/model registry checks reject unsupported Codex models before a worker
  command can be generated.

By default, a missing global reference is a warning because this repo should not
mutate the operator's global Codex config without explicit intent. Use
`STRICT_CODEX_LIFECYCLE_HOOKS=1` to make that warning fail the audit.

## Limitation

Codex hooks can observe session, tool, compaction, and stop events. They cannot
reliably infer every human intent or every possible process owner. Treat the
hook as a guardrail around durable artifacts, not as the lifecycle source of
truth. The source of truth remains:

```text
/Users/richardadair/.agents/skills/chores/SKILL.md
/Users/richardadair/.agents/skills/done/SKILL.md
memory/handoff.md or .claude/memory/handoff.md in the active repo
memory/session-status.json in the active repo
```
