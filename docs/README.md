# Docs Index

This directory is the durable knowledge base for `agent-launch-scripts`. Keep `AGENTS.md` short and use this index as the map to deeper source-of-truth files.

## Read Order

1. `../AGENTS.md` — model-agnostic agent map.
2. `../context.md` — current model/runtime and ACRM operating contract.
3. `../README.md` — short human-facing repo summary.
4. `product/agentremote.md` — product boundary and money-path focus.
5. `operations/launch-scripts.md` — launcher, tmux, and deployment control notes.
6. `operations/agentremote-recovery-list.md` — recurring AgentRemote/iTerm/tmux fixes Richard should not have to restate.
7. `../DESIGN.md` — current AgentRemote visual system and migration target.
8. `exec-plans/active/agentremote-v1-pivot-plan.md` — active pivot work plan.
9. `../tasks/ALS-002-infra-audit.md` and `../tasks/ALS-002-regression-audit.md` — audit evidence behind the active plan.
10. `references/harness-engineering-rd-query.md` — R&D QMD/graphify retrieval report and repo-structure rationale.
11. `references/2026-05-06-codex-skill-command-visibility-report.md` — Codex lifecycle skill visibility report for Lucius/R&D.

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

## Location

The canonical checkout is `/Users/richardadair/ai_projects/agent-launch-scripts`. See `operations/repo-location-migration.md` for the cutover contract and compatibility symlink.
