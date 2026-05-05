# Docs Index

This directory is the durable knowledge base for `agent-launch-scripts`. Keep `AGENTS.md` short and use this index as the map to deeper source-of-truth files.

## Read Order

1. `../AGENTS.md` — model-agnostic agent map.
2. `../context.md` — current model/runtime and ACRM operating contract.
3. `../README.md` — short human-facing repo summary.
4. `product/agentremote.md` — product boundary and money-path focus.
5. `operations/launch-scripts.md` — launcher, tmux, and deployment control notes.
6. `../DESIGN.md` — current AgentRemote visual system and migration target.
7. `exec-plans/active/agentremote-v1-pivot-plan.md` — active pivot work plan.
8. `../tasks/ALS-002-infra-audit.md` and `../tasks/ALS-002-regression-audit.md` — audit evidence behind the active plan.
9. `references/harness-engineering-rd-query.md` — R&D QMD/graphify retrieval report and repo-structure rationale.

## Directory Contract

| Directory | Purpose |
|---|---|
| `product/` | Product boundaries, scope decisions, and user-value framing. |
| `operations/` | Runtime, launch, tmux, deployment, and local-process control docs. |
| `exec-plans/active/` | Current execution plans that agents should update as work proceeds. |
| `exec-plans/completed/` | Completed plans after they are closed out. |
| `references/` | External-source notes, retrieval reports, and copied vendor/reference material. |
| `generated/` | Generated maps or schema docs, if the repo later needs them. |

## Maintenance Rules

- Move stale plans to `exec-plans/completed/` or archive them with a redirect note.
- Keep claims about live behavior tied to scripts, audits, or verification commands.
- Prefer linking to root docs over duplicating their content until those docs are split.
- Update this index when adding a new durable doc.
