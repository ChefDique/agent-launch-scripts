# AgentRemote Product Boundary

## Positioning

AgentRemote is the lightweight local operator HUD for communicating with and controlling Richard's local agent fleet. Its near-term value is speed: select agents, speak or type once, send instantly, and keep the panel attractive enough to live on the desktop.

## In Scope

- Spawn, attach, restart, stop, and broadcast to local agent sessions.
- Keep selected agents visible through a compact dock and status dots.
- Preserve the hold-to-talk local STT path: hold an agent key, transcribe locally, send immediately on release.
- Show send/transcription feedback clearly enough that the operator trusts delivery.
- Surface a designed Codex pet/companion layer as a visual affordance, without making it a dependency for messaging.
- Stay model/runtime agnostic at the remote layer: the HUD controls local processes and panes, not a single model vendor.

## Out of Scope

- Full ACRM command-center behavior.
- Atlas room-grid or isometric mission-control state.
- Swarmy worker-spawn orchestration as a hard dependency.
- Canonical multi-agent memory, task registry, or messaging backend ownership.

## Product Rule

Do not over-invest in speculative platform surfaces before the core remote feels useful: communication, local voice, delivery feedback, and a polished always-on-top presence.

## Current Sources

- `../exec-plans/active/agentremote-v1-pivot-plan.md` for active work priority.
- `../../DESIGN.md` for design tokens and current architecture notes.
- `../../remote-app/` for the shipping prototype.
