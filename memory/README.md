# memory/

Visible repo/pod operational memory. This folder lives at the repo or pod root, never under `.claude/` or `.agents/`.

## Standard Layout

| Path | Purpose | Update when |
|---|---|---|
| `handoff.md` | Active thread + Open priorities + Cross-session comms. NOT session log. | Active thread or priorities changed. Overwrite each /chores. |
| `agent-notes/<slug>.md` | Per-agent reusable learnings. Append-only. | A learning should affect future sessions for this agent role. |
| `sessions/YYYY-MM-DD_HHMM_<slug>.md` | Durable session receipts. One file per closed Open priority or per /done. | /chores closes an Open priority OR /done runs. |
| `coord/` | Cross-agent or cross-project messages. | A peer message must survive chat/session loss. |
| `audits/` | Drift findings, verification receipts, review notes. | You audited or verified a system surface. |
| `decisions/` | Local decision notes. | Decision is local to this repo/pod, not shared-vault doctrine. |
| `tasks/` | Local task supplements. | Tracker row needs body/detail too large for the row. |
| `workflows/` | Runtime workflow state. | A recurring or autonomous run needs local operational memory. |

## The prune-and-fold rule

`handoff.md` stays small forever:

- **Active thread** is overwritten each `/chores`, not appended.
- When an Open priority closes, `/chores` PRUNES it from `handoff.md` AND writes the closed work to `sessions/YYYY-MM-DD_HHMM_<topical-slug>.md`.
- Session history is browsable via `ls sessions/`, not by scrolling `handoff.md`.

## Closeout Rule

Update the smallest valid surface:

1. tracker/task row (ACRM / GitHub) for status
2. `handoff.md` for restart cursor (overwrite Active thread)
3. `sessions/<dated-file>.md` for closed priority OR /done receipt
4. `agent-notes/<slug>.md` for reusable learning
5. `coord/` for peer handoff
6. `audits/` for verification evidence

Do NOT mix purposes. Tracker rows are status; handoff is cursor; sessions are history; agent-notes is learnings; coord is messages; audits is verification.
