# agent-launch-scripts Context

This repo is Richard's local operator station for supervising agent sessions. It owns the per-agent shell launchers, registry data, and the lightweight AgentRemote Electron HUD; Swarmy owns AgentRemote's deploy/attach/stop/layout runtime.

## Runtime Policy

- The launcher stack must stay model/runtime agnostic across Codex, Claude, Hermes, and OpenClaw.
- Codex is the current priority runtime because Claude session starts can waste scarce Claude tokens.
- Swarmy's AgentRemote runtime adapter is the app runtime boundary for deploy/attach/stop/layout. `launch-agent.sh` remains the per-agent process boundary: it reads `agents.json`, builds argv arrays, and execs the configured model runtime.
- Missing `runtime` values default to Codex, not Claude.
- `runtime: "codex"` must launch `codex`, not `claude`. Claude-only boot behavior such as `/color` and `/rename` auto-injects must stay gated to `runtime: "claude"`.
- A `runtime: "claude"` registry entry must set `allow_claude_runtime: true`; the launcher test fails accidental Claude runtime entries.
- For Codex entries, the default operator posture is `gpt-5.5`, `model_reasoning_effort=high`, `sandbox=danger-full-access`, and `approval_policy=never`, unless the registry says otherwise.
- Preserve Hermes and OpenClaw cases even when Codex is the immediate path. Do not collapse the registry back to Claude-only assumptions.
- Hidden Claude spend counts as a runtime violation. During Codex-constrained periods, startup hooks, launchd jobs, scheduled readers, and skills must not invoke `claude` or `claude -p` unless Richard explicitly authorizes that path.

## Registry And ACRM Boundary

- `agents.json` is the local execution registry and AgentRemote settings source. It is the file the launch scripts and Electron app can consume today.
- ACRM is the coordination and registry decision plane for task creation, review state, and agent lookup/creation workflows.
- When adding or looking up agents from AgentRemote, prefer an ACRM-backed path for identity and metadata, then persist the local launch/runtime settings needed by this repo.
- ACRM schema constraints may lag runtime reality. If the ACRM agent registry cannot store a GPT model name yet, keep the true runtime/model details in `agents.json` and record the schema mismatch in the task evidence instead of inventing duplicate secrets or extra user prompts.

## Review Ownership

- Codex owns the technical review loop for this repo. Fix obvious implementation or documentation defects directly, rerun the relevant checks, and report afterward.
- Defer to Richard only for exec decisions: product direction, risk tolerance, credentials, destructive operations, external spend, ownership boundaries, or ambiguous tradeoffs that are not obvious from the repo contract.

## Verification Defaults

- Launcher or registry edits: `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`, `jq . agents.json`, `bash test/launch-agent-runtime.test.sh`, and `python3 -m pytest /Users/richardadair/ai_projects/swarmy/tests/test_agentremote_runtime.py -q`.
- Electron edits: `cd remote-app && npm test`; use `bash launch-remote.sh` only when a live AgentRemote restart is needed, and avoid duplicate app instances.
- Git hygiene: check `git status --short --branch` before editing, commit completed local work units, and push only when Richard asks.
