# AgentRemote PRD

## Plain-English Summary

AgentRemote is Richard's always-available local operator HUD for working with
the agent fleet on this machine.

The app should make the common loop fast and trustworthy:

1. Pick an agent, team, runtime, and profile.
2. Spawn, attach, stop, restart, or send a message.
3. See clear proof that the selected local process, pane, and viewer are the
   ones being controlled.
4. Leave the machine without stale windows, wrong-runtime panes, or phantom
   "success" states.

AgentRemote is not the full ACRM command center. It is the desktop remote:
compact, fast, local, and honest about what it actually touched.

## User

The primary user is Richard operating several local agent sessions at once. He
needs a small surface that can stay near the work, send messages quickly, reveal
the right live agent, and avoid turning normal terminal windows into agent
harnesses.

## Product Promise

AgentRemote should feel like a reliable remote control, not another system to
manage. If the app says an action happened, the underlying runtime, tmux pane,
and visible desktop state must support that claim.

The app earns trust by being boring in the right places:

- Runtime choices are explicit and preserved.
- Agent identity comes from the registry, not hardcoded names.
- Send means the target received and submitted the message.
- Attach means the right live pane can be revealed without desktop junk.
- Cleanup leaves no mystery Electron apps, helper shells, or stale viewers.

## In Scope

- Local fleet control: spawn, attach, stop, restart, kill, status, and broadcast.
- Runtime/profile selection for supported local runtimes such as Codex, Claude,
  Hermes, and OpenClaw.
- Registry-backed agent identity, display names, teams, layout settings, and
  launch options.
- Fast text and voice messaging to selected agents or teams.
- Embedded terminal and paste paths that preserve operator input safely.
- Pet and pet-chat surfaces as optional operator affordances, not as the source
  of truth.
- Version, branch, runtime, and delivery feedback that helps Richard spot stale
  app instances.

## Out Of Scope

- Replacing ACRM as the durable task, profile, registry, or command-center
  surface.
- Replacing Swarmy as the live spawn/layout/attach runtime adapter.
- Turning Atlas or an isometric room grid into the AgentRemote core UI.
- Treating internal Codex subagents as AgentRemote-visible local agents.
- Using normal terminal attach workarounds to claim AgentRemote success.

## Required Sources Of Truth

Future sessions should use this PRD as the product entry point, then follow the
specific source for the surface they are changing:

| Need | Source |
|---|---|
| Product boundary and non-goals | `docs/product/agentremote.md` |
| Feature inventory and expected behavior | `docs/product/agentremote-feature-index.md` |
| Regression matrix and required checks | `docs/operations/agentremote-quality-gates.md` |
| Runtime, layout, window, send, paste, pet-chat, and closeout contract | `docs/operations/agentremote-operator-contract.md` |
| Launcher, tmux, deployment, and verification commands | `docs/operations/launch-scripts.md` |
| Visual system and UI behavior | `DESIGN.md` |
| Current implementation rules for Electron/IPC/UI edits | `remote-app/AGENTS.md` |
| Current board and quality-task ownership | `tasks.json` |

`agentremote-feature-index.md` and `agentremote-quality-gates.md` are tracked by
ALS-QUALITY-001 and ALS-QUALITY-003. If a future session finds either missing or
stale, it should treat that as an active documentation gap, not as permission to
invent behavior from memory.

## Must Not Regress

These are the short-form product rules. The detailed contract lives in
`docs/operations/agentremote-operator-contract.md`.

- Selecting Codex must launch Codex. Selecting Claude must launch Claude only
  when the registry explicitly allows Claude.
- AgentRemote must control agents through registry and runtime policy, not
  hardcoded branches for individual agents.
- AgentRemote must not mutate Richard's live iTerm/tmux desktop unless the
  current task explicitly asks for that live action.
- A green static test must not be described as live attach/deploy proof.
- A gateway process must not be counted as a usable interactive agent pane.
- Send and paste changes must prove that input reaches the target instead of
  only updating local UI state.
- Layout changes must preserve the one-agent-process, one-live-tmux-pane
  invariant before any viewer materialization.
- Pet chat must show relevant conversation output, not terminal chrome or
  unrelated agent streams.
- Closeout must classify dirty files and report any app/runtime state that was
  not live-tested.

## Quality Gates

Every AgentRemote change should answer three questions before it ships:

1. Which feature entry changed?
   Use `docs/product/agentremote-feature-index.md` when it exists. If the entry
   is missing, add or request that entry before broad implementation work.
2. Which regression gate applies?
   Use `docs/operations/agentremote-quality-gates.md` for required static,
   isolated tmux, renderer, or manual-live checks.
3. What proof is safe in this task?
   Prefer static tests, mocked IPC, and isolated throwaway sessions. Live desktop
   proof needs Richard's current-turn permission.

Docs-only tasks can verify by checking links, paths, spelling, and git scope.
Runtime, launcher, or UI tasks need stronger proof from the relevant source
docs.

## Success Criteria

AgentRemote is successful when Richard can:

- See the fleet state at a glance.
- Select an agent or team without guessing what runtime will launch.
- Send text, voice, and paste payloads with clear delivery feedback.
- Attach or reveal the correct local agent surface when needed.
- Recover from stale state without manual archaeology.
- Close a session knowing what changed, what was tested, and what remains
  blocked.

The app does not need to be large to be valuable. It needs to be truthful,
fast, and easy to trust.
