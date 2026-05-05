# agent-launch-scripts Context

This repo is Richard's local operator station for launching and supervising agent sessions. It owns the shell launchers, tmux orchestration, and the lightweight AgentRemote Electron HUD.

## Runtime Policy

- The launcher stack must stay model/runtime agnostic across Codex, Claude, Hermes, and OpenClaw.
- Codex is the current priority runtime because Claude session starts can waste scarce Claude tokens.
- `launch-agent.sh` is the runtime boundary. It reads `agents.json`, builds argv arrays, and execs the configured runtime.
- `runtime: "codex"` must launch `codex`, not `claude`. Claude-only boot behavior such as `/color` and `/rename` auto-injects must stay gated to `runtime: "claude"`.
- For Codex entries, the default operator posture is `gpt-5.5`, `model_reasoning_effort=high`, `sandbox=danger-full-access`, and `approval_policy=never`, unless the registry says otherwise.
- Preserve Hermes and OpenClaw cases even when Codex is the immediate path. Do not collapse the registry back to Claude-only assumptions.

## Registry And ACRM Boundary

- `agents.json` is the local execution registry and AgentRemote settings source. It is the file the launch scripts and Electron app can consume today.
- ACRM is the coordination and registry decision plane for task creation, review state, and agent lookup/creation workflows.
- When adding or looking up agents from AgentRemote, prefer an ACRM-backed path for identity and metadata, then persist the local launch/runtime settings needed by this repo.
- ACRM schema constraints may lag runtime reality. If the ACRM agent registry cannot store a GPT model name yet, keep the true runtime/model details in `agents.json` and record the schema mismatch in the task evidence instead of inventing duplicate secrets or extra user prompts.

## Review Ownership

- Codex owns the technical review loop for this repo. Fix obvious implementation or documentation defects directly, rerun the relevant checks, and report afterward.
- Defer to Richard only for exec decisions: product direction, risk tolerance, credentials, destructive operations, external spend, ownership boundaries, or ambiguous tradeoffs that are not obvious from the repo contract.

## Verification Defaults

- Launcher or registry edits: `bash -n chq-tmux.sh launch-agent.sh launch-remote.sh scripts/cron-poke.sh`, `jq . agents.json`, and `bash test/launch-agent-runtime.test.sh`.
- Electron edits: `cd remote-app && npm test`; use `bash launch-remote.sh` only when a live AgentRemote restart is needed, and avoid duplicate app instances.
- Git hygiene: check `git status --short --branch` before editing, commit completed local work units, and push only when Richard asks.
