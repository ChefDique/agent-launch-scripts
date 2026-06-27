# Handoff — Neo (`neo`)

<!-- HOW TO MAINTAIN THIS FILE — don't delete this block:
  · State    = where things stand NOW. Overwrite each /chores, ≤5 lines, never append.
  · Next     = checkbox queue. Check [x] done, add what you find. Unchecked = where next session starts.
  · Blockers = what stops progress, or "none".
  · PRUNE = MOVE, never delete: finished → memory/handoff-archive.md (under today's date);
            durable lesson → rules/ or agent-notes/. Keep State+Next under ~1500 chars.
-->

## State

`ALS-LOCAL-016` code is pushed on `main` (`9888d8f`; AgentRemote v1.6.3), with the board at `review_pending` in `memory/tasks/tasks.json`. Local launcher, renderer, audit, syntax, and Swarmy checks pass; full `npm test` is 189/190 only because the unrelated pre-existing transcript-source test fails. The live kenpachi deploy proof has not been run. Existing unrelated dirt remains: `agents.json`, `26-06-20_neo-chat-export.txt`, `docs/exec-plans/active/agentremote-elevation-plan.md`, and `docs/product/agentremote-affordances.md`.

## Next

- [ ] With explicit approval for live desktop mutation, use the canonical v1.6.3 HUD to confirm kenpachi has `startup_slash=""`, deploy kenpachi once, and verify `/lead-gogo` does not run. Check `$TMUX_PANE` first and do not kill or repurpose the current Neo pane/session.
  > ACCEPTANCE CRITERIA: The deployed kenpachi session starts without `/lead-gogo`; record the live proof in `ALS-LOCAL-016` without changing the empty field before deployment.
- [ ] Reconcile `ALS-LOCAL-016` after the live proof, then return to the canonical board priority.
  > ACCEPTANCE CRITERIA: Mark it `done` only after successful live proof; otherwise return it to active work with the observed failure. Resume `ALS-DESIGN-001` only after this reconciliation.

## Blockers

- Live AgentRemote/tmux/iTerm mutation requires Richard's explicit approval.
