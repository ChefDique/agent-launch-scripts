# Message-Agent Pane Pairing Sync Proposal

Date: 2026-05-09
Status: proposal for validation
Owner: Neo / `tmux-masta`

## Problem

AgentRemote tracks live agent panes by stable tmux pane id in
`/tmp/agent-remote-panes.json`. Message-agent standalone listeners currently
pair Claude identities to a `session:window.pane` coordinate captured at
registration time, such as `chq:0.1`.

That coordinate is not stable. AgentRemote can move panes during deploy,
layout normalization, attach break-out, or manual recovery. When the pane index
changes, a listener can keep sending inbound messages to the old coordinate.
The observed failure was:

- `lucius-claude` listener was registered to `chq:0.1`.
- AgentRemote sidecar showed Lucius at stable pane `%515`, currently `chq:0.2`.
- Neo / `tmux-masta` was currently `chq:0.1` / `%552`.
- A message addressed to `lucius-claude` surfaced in Neo's Codex chat.

This is a comms integrity bug. It can cause an agent to see another agent's
private status, miss its own messages, or act on work intended for another
runtime.

## Goals

- Inbound message delivery must target the intended live agent pane after
  AgentRemote layout changes.
- Message-agent should prefer stable pane ids over brittle tmux coordinates.
- AgentRemote and message-agent must share one source of truth for live pane
  identity instead of independently caching coordinates.
- If delivery cannot prove the target pane belongs to the intended agent, it
  should fail closed to inbox-only delivery and avoid `tmux send-keys`.
- The fix must preserve Aria's current `agent_bus_send.sh` attribution change
  in `tools/message-agent`.

## Non-Goals

- Do not redesign message-agent routing, Hermes profile delivery, or Discord
  channel strategy.
- Do not require AgentRemote to become the message-agent owner.
- Do not route every inbound message through AgentRemote's Electron process.
- Do not use user-visible iTerm attachment state as delivery truth.

## Proposed Architecture

Use a two-layer correction:

1. Add a shared message-agent sync helper that reads AgentRemote's sidecar and
   updates standalone listener pairing metadata for identities that map to
   local AgentRemote agents.
2. Add a pre-delivery guard inside `agent_bus_listener.py` so stale listener
   pairings cannot inject into the wrong pane even if the sync hook is missed.

The sidecar remains the live truth:

```text
agent id -> stable pane_id -> current tmux coord
```

Message-agent listener state should store enough metadata to resolve from that
truth:

```text
identity: lucius-claude
agent_id: lucius
pane_id: %515
last_coord: chq:0.2
delivery: both
```

At delivery time, the listener should target `pane_id` when available. If only
a coordinate is available, it should be treated as a legacy fallback and
validated against tmux pane title/sidecar ownership before injection.

## Ownership Boundary

Message-agent owns delivery safety. It should refuse stale live-pane delivery.

AgentRemote owns pane movement. After any operation that can move panes, it
should call the sync helper with the affected agent id or run a scoped refresh
for the session.

The sync helper is the integration seam. It can live in `tools/message-agent`
because it updates listener state and knows message-agent identity naming, but
it should consume AgentRemote sidecar data rather than duplicating pane
resolution logic.

## Trigger Points

AgentRemote should invoke the sync helper after:

- deploy and add-agent paths that create panes,
- layout normalization that joins or breaks panes,
- `attach-pane` when it runs `tmux break-pane`,
- kill/restart paths that remove or recreate panes,
- startup/runtime recovery that rewrites `/tmp/agent-remote-panes.json`.

Message-agent should also validate on every inbound delivery. The trigger hook
improves freshness; the delivery guard enforces correctness.

## Identity Mapping

Use registry-driven mapping rather than hardcoded agent names:

- `lucius-claude` maps to AgentRemote `lucius`.
- `xavier-claude` maps to AgentRemote `xavier`.
- Future identities can provide explicit `agentremote_agent_id` metadata.
- As a fallback, strip a known runtime suffix (`-claude`, `-codex`,
  `-hermes`, `-openclaw`) only in the sync helper, with tests.

Do not infer from display names, window titles, or current active pane.

## Failure Behavior

If message-agent cannot prove the live pane:

- write the message to the recipient inbox,
- skip tmux `send-keys`,
- return or log a clear degraded-delivery status,
- include the stale configured target and the expected identity in the log.

This prevents cross-agent leakage while preserving async delivery.

## Testing Plan

- Unit test identity-to-agent mapping from registry metadata and runtime
  suffixes.
- Unit test sidecar resolution where a stable pane id moves from `chq:0.1` to
  `chq:0.2`.
- Unit test `agent_bus_listener.py` delivery guard refusing stale coordinate
  injection.
- Static AgentRemote test that attach/deploy/layout paths call the sync helper
  after pane movement.
- Integration smoke with a throwaway tmux session:
  - register a fake listener to an initial coord,
  - move the pane,
  - refresh from sidecar,
  - deliver a message,
  - assert it reaches the moved pane and not the old coord.

## Rollout Plan

1. Add message-agent sync helper and tests in
   `/Users/richardadair/ai_projects/tools/message-agent`.
2. Add delivery guard to `agent_bus_listener.py`.
3. Add AgentRemote call sites in `remote-app/main.js` and Swarmy runtime paths
   that mutate sidecar/layout.
4. Run tests in both repos.
5. Restart only the affected stale listeners after proof:
   - `lucius-claude` should move from `chq:0.1` to pane `%515`.
   - `xavier-claude` should remain on its verified pane.
6. Document the invariant in AgentRemote and message-agent closeout docs.

## Open Questions For Validation

- Should listener state store `pane_id` directly, or should it store only
  `agentremote_agent_id` and resolve pane id on each delivery?
- Should AgentRemote invoke a sync helper after every attach, or only after
  actual pane movement?
- Should stale live-pane delivery return HTTP `202` with degraded status, or
  a non-2xx transport failure?
- What should be the canonical route for getting Aria's comms-owner review
  back to Neo when Neo has no message-agent listener?

## Current Aria Input Status

Neo sent Aria a comms-owner review request with correlation
`tmux-masta-codex-to-aria-hermes-1778301854`. Her response is pending at the
time this proposal was written.
