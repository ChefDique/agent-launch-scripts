# Learnings

## [LRN-20260508-001] correction

**Logged**: 2026-05-08T01:45:00-07:00
**Priority**: critical
**Status**: promoted
**Area**: docs

### Summary
AgentRemote requirements were scattered across handoff history, memory, and operation notes, so future sessions kept fixing one behavior while regressing another.

### Details
Richard repeatedly corrected the same requirements: AgentRemote must dynamically spawn the selected agent/runtime/model, must preserve one-agent-per-pane tmux identity, must not turn arbitrary terminals into Codex harnesses, must not use normal `tmux attach` as a workaround, must not leave stale iTerm/control-mode windows behind, and must prove live runtime truth before claiming success. These were documented in fragments but not promoted into one mandatory contract that every AgentRemote change must read.

### Suggested Action
Treat `docs/operations/agentremote-operator-contract.md` as the mandatory source of truth before AgentRemote, launch-script, Swarmy-adapter, tmux/iTerm, pet-chat, paste, or runtime-selection edits. If implementation conflicts with that contract, stop and update the contract or file an explicit task before coding.

### Metadata
- Source: user_feedback
- Related Files: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md, /Users/richardadair/ai_projects/agent-launch-scripts/AGENTS.md, /Users/richardadair/ai_projects/agent-launch-scripts/CLAUDE.md, /Users/richardadair/ai_projects/agent-launch-scripts/remote-app/AGENTS.md
- Tags: agentremote, runtime_truth, loop_control, operator_visibility, spawn_lifecycle
- Pattern-Key: agentremote.operator_contract_missing
- Recurrence-Count: 1
- First-Seen: 2026-05-08
- Last-Seen: 2026-05-08
- Control Surface: /Users/richardadair/ai_projects/agent-launch-scripts/docs/operations/agentremote-operator-contract.md
- Loop Owner: runtime-truth
- Verification: `test -f docs/operations/agentremote-operator-contract.md && rg -n "agentremote-operator-contract|Operator Contract" AGENTS.md CLAUDE.md docs/README.md remote-app/AGENTS.md`

### Resolution
- **Resolved**: 2026-05-08T01:45:00-07:00
- **Commit/PR**: pending
- **Notes**: Promoted the scattered requirements into a dedicated operator contract and linked it from startup/checklist docs.

---
