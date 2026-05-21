# Docs Index

This directory is the durable knowledge base for `agent-launch-scripts`. Keep `AGENTS.md` short and use this index as the map to deeper source-of-truth files.

**Start here for the current state of the app:** [`agentremote-reference.md`](agentremote-reference.md) — the single up-to-date "how AgentRemote actually works now" reference (architecture, send path, runtime/model catalog, IPC surface, pane targeting, deploy/attach, pet chat, tests). Kept current with the shipping `remote-app/` code.

## Read Order

1. `../AGENTS.md` — model-agnostic agent map.
2. `../context.md` — current model/runtime and ACRM operating contract.
3. `../README.md` — short human-facing repo summary.
4. `product/agentremote-prd.md` — plain-English app purpose, contract index, and "must not regress" rules.
5. `product/agentremote.md` — compact product boundary and money-path focus.
6. `product/agentremote-feature-index.md` — feature inventory, source files, expected behavior, and verification notes.
7. `operations/agentremote-quality-gates.md` — regression matrix and required quality checks by surface.
8. `operations/agentremote-completion-audit.md` — prompt-to-artifact checklist for what is done, blocked, or still not live-verified.
9. `operations/agentremote-operator-contract.md` — canonical "what Richard wants" contract for spawn/layout/runtime/window behavior.
10. `operations/launch-scripts.md` — launcher, tmux, and deployment control notes.
11. `operations/codex-lifecycle-hooks.md` — Codex hook parity for `/chores` and `/done` checkpoint nudges.
12. `operations/agentremote-recovery-list.md` — recurring AgentRemote/iTerm/tmux fixes Richard should not have to restate.
13. `../DESIGN.md` — current AgentRemote visual system and migration target.
14. `exec-plans/active/agentremote-v1-pivot-plan.md` — active pivot work plan.
15. `../tasks/ALS-002-infra-audit.md` and `../tasks/ALS-002-regression-audit.md` — audit evidence behind the active plan.
16. `references/harness-engineering-rd-query.md` — R&D QMD/graphify retrieval report and repo-structure rationale.
17. `references/2026-05-06-codex-skill-command-visibility-report.md` — Codex lifecycle skill visibility report for Lucius/R&D.

`product/agentremote-feature-index.md` and
`operations/agentremote-quality-gates.md` are quality-task artifacts. If either
is absent or stale, future AgentRemote sessions should treat that as a tracked
documentation gap before broad app work.

## Directory Contract

| Directory | Purpose |
|---|---|
| `product/` | Product boundaries, scope decisions, and user-value framing. |
| `operations/` | Runtime, launch, tmux, deployment, and local-process control docs. |
| `exec-plans/active/` | Current execution plans that agents should update as work proceeds. |
| `exec-plans/completed/` | Completed plans after they are closed out. |
| `references/` | External-source notes, retrieval reports, and copied vendor/reference material. |
| `generated/` | Generated maps or schema docs, if the repo later needs them. |

## AgentRemote Contract Stack

For AgentRemote work, start with `product/agentremote-prd.md`, then narrow to
the relevant contract instead of copying large sections into a new brief:

| Question | Read |
|---|---|
| How does the whole app work right now? | `agentremote-reference.md` |
| What is the app for? | `product/agentremote-prd.md` |
| What features exist and where are they implemented? | `product/agentremote-feature-index.md` |
| What checks are required before shipping? | `operations/agentremote-quality-gates.md` |
| What is actually done versus blocked right now? | `operations/agentremote-completion-audit.md` |
| What live runtime behavior must not be violated? | `operations/agentremote-operator-contract.md` |
| How do launchers, tmux, and Swarmy fit together? | `operations/launch-scripts.md` |
| What should it look and feel like? | `../DESIGN.md` |

## Maintenance Rules

- Move stale plans to `exec-plans/completed/` or archive them with a redirect note.
- Keep claims about live behavior tied to scripts, audits, or verification commands.
- Prefer linking to root docs over duplicating their content until those docs are split.
- Update this index when adding a new durable doc.

## Location

The canonical checkout is `/Users/richardadair/ai_projects/agent-launch-scripts`. See `operations/repo-location-migration.md` for the cutover contract and compatibility symlink.
