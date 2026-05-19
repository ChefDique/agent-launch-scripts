# Handoff — Neo (`tmux-masta`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** AgentRemote terminal behavior fixed by restarting stale wrapped Codex child processes.

**State at last pause (2026-05-19T01:07:39-0700):**
- Root cause was stale live wrapped processes: Mugatu had already relaunched under the current `launch-agent.sh`/registry path, while Xavier, Dasha, and Lucius were still old `gpt-5.3-codex` Codex children from 2026-05-18 13:00.
- Fix applied without code changes: killed only the stale Codex child PIDs for Xavier, Dasha, and Lucius; their existing wrapper parents auto-restarted them through `/tmp/swarmy-agentremote-runtime/chq-*.sh` and `launch-agent.sh`.
- Verification: Mugatu, Xavier, Dasha, and Lucius now all show live `codex --model gpt-5.5 --ask-for-approval never --sandbox danger-full-access ... --no-alt-screen /lead-gogo`; Richard confirmed the terminal behavior is fixed.
- Important correction: when already-running AgentRemote panes differ, check live process age/command first. Script changes do not affect already-running Codex TUIs until the wrapped child is restarted.

**Next verifiable step:** Wait for direction; for any recurring terminal regression, compare live process command/age first and restart only the stale wrapped child before touching code.

**If that step fails:** If a restarted current child still differs from Mugatu, then isolate with throwaway `tmux -CC` capture before patching.

**Pending uncommitted diff:** done closeout memory files only until committed.

## Open priorities (<=5)

- [BLOCKED] **AgentRemote popup sizing/clipping** — visible screenshot shows add/edit popup still clipped; previous dynamic resize fix is incomplete.
- [WAIT] **AgentRemote Deploy permanent fix** — clear tmux `@hidden` and `@buried_indexes` before iTerm control-mode attach/deploy; not part of the terminal/resize closeout.

## Cross-session comms

_None._
