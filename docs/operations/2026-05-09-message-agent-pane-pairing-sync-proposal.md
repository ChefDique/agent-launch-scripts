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
3. Add a delivery-finalization policy so a correctly targeted message is also
   submitted to the agent TUI instead of being left in the input buffer.

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

For interactive TUI delivery, "delivered" means "visible input was submitted,"
not merely "text was pasted." AgentRemote's hardened send path already sends
literal text, then `C-m`, waits briefly, then sends `Enter` to recover the
common typed-but-not-submitted state. Message-agent should adopt an equivalent
runtime-aware submit policy for Claude/Codex-style panes, with tests that prove
the block is not just left queued in the input line.

## Ownership Boundary

Message-agent owns delivery safety. It should refuse stale live-pane delivery.
It also owns final delivery semantics: if it claims live delivery, it must send
the submit key sequence required by the target harness or report a degraded
delivery instead of claiming success.

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

- `lucius-claude` maps to AgentRemote `lucius` through explicit
  `agentremote_agent_id` metadata.
- `xavier-claude` maps to AgentRemote `xavier` through explicit
  `agentremote_agent_id` metadata.
- As a migration fallback only, strip a known runtime suffix (`-claude`,
  `-codex`, `-hermes`, `-openclaw`) when there is exactly one unambiguous live
  AgentRemote match. Ambiguity must fail closed.

Do not infer from display names, window titles, or current active pane.
Do not fall back across runtimes. A stale `lucius-claude` coordinate that now
points to Neo is a hard stop, not a reason to deliver to Neo.

## Failure Behavior

If message-agent cannot prove the live pane:

- write the message to the recipient inbox,
- skip tmux `send-keys`,
- return or log a clear `delivered_inbox_only_with_warning` /
  `refused_live_injection` status,
- include the stale configured target and the expected identity in the log.

This prevents cross-agent leakage while preserving async delivery.

## Testing Plan

- Unit test identity-to-agent mapping from registry metadata and runtime
  suffixes.
- Unit test sidecar resolution where a stable pane id moves from `chq:0.1` to
  `chq:0.2`.
- Unit test `agent_bus_listener.py` delivery guard refusing stale coordinate
  injection.
- Unit test that a stale coord now pointing to another pane never falls back to
  that pane for live delivery.
- Unit test missing sidecar, invalid JSON, and stale `updated_at` all produce
  inbox-only delivery with no tmux injection.
- Unit test the submit policy emits the configured TUI submit sequence after
  literal text delivery; preserve AgentRemote's `C-m` + delayed `Enter`
  behavior for Claude/Codex-style panes.
- Static AgentRemote test that attach/deploy/layout paths call the sync helper
  after pane movement.
- Integration smoke with a throwaway tmux session:
  - register a fake listener to an initial coord,
  - move the pane,
  - refresh from sidecar,
  - deliver a message,
  - assert it reaches the moved pane and not the old coord.
- Integration smoke that starts the listener with stale `chq:0.1`, moves
  Lucius to a different pane id, sends to `lucius-claude`, and proves the
  message is submitted in Lucius's pane, not left queued in Neo's input.
- Regression test that Aria's `agent_bus_send.sh` attribution fix remains:
  positional convenience form uses `AGENT_BUS_FROM`, then
  `MESSAGE_AGENT_FROM`, then historical fallback.

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
  `agentremote_agent_id` and resolve pane id on each delivery? Aria recommends
  delivery-time resolution with listener startup config as bootstrap only.
- Should AgentRemote invoke a sync helper after every attach, or only after
  actual pane movement?
- Should stale live-pane delivery return HTTP `202` with degraded status, or
  a non-2xx transport failure?
- What should be the canonical route for getting Aria's comms-owner review
  back to Neo when Neo has no message-agent listener?

## Aria Comms-Owner Review

Aria responded on correlation
`tmux-masta-codex-to-aria-hermes-1778301854`. Her position:

- Delivery should resolve to a stable tmux pane id at send time, not trust
  listener-start `session:window.pane` coordinates.
- Ownership is shared but single-sourced: AgentRemote owns runtime identity to
  current pane state; message-agent owns safe delivery and fail-closed guards;
  a shared helper should perform read/validate/resolve so both systems use the
  same logic.
- AgentRemote should refresh after deploy, layout normalization, attach
  break-pane, stop, and restart, but delivery-time resolve and guard is the
  safety net.
- Prefer hot reconfiguration or delivery-time resolution over listener
  restarts on attach. Listener restarts are acceptable for stop/start or
  port/secret changes, not routine pane moves.
- Listener health must show configured and resolved targets:
  `configured_coord`, `configured_pane_id`, `resolved_pane_id`,
  `resolved_coord`, `resolved_identity`, freshness, and stale status.
- AgentRemote JSON writes must be atomic with `updated_at`; message-agent
  treats stale, missing, or invalid JSON as no-live-injection.
- Preserve the dirty `tools/message-agent/scripts/agent_bus_send.sh`
  attribution fix.

Aria's observed proof matches the incident: message-agent still reports
`lucius-claude` paired to `chq:0.1`; AgentRemote sidecar says Lucius is `%515`;
tmux currently shows `%552` at pane index 1 and `%515` at pane index 2. The
proposed guard would have prevented the misdelivery.
