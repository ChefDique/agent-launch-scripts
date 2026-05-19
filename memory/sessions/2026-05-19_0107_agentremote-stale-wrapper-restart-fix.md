# AgentRemote Stale Wrapper Restart Fix — 2026-05-19 01:07

## Outcome
AgentRemote terminal behavior was fixed by restarting stale wrapped Codex child processes for Xavier, Dasha, and Lucius. The earlier answer that no restart was needed was wrong; live panes do not inherit launcher/config changes until their running Codex process is restarted.

## Work shipped
- Compared Mugatu against Xavier, Dasha, and Lucius at the live process layer instead of continuing to patch terminal code.
- Found Mugatu had relaunched at 2026-05-19 00:35 with `gpt-5.5`, while Xavier, Dasha, and Lucius were still `gpt-5.3-codex` children from 2026-05-18 13:00.
- Verified the generated `/tmp/swarmy-agentremote-runtime/chq-*.sh` wrappers were the same template and that the stale children were the meaningful difference.
- Killed only the stale Codex child processes for Xavier, Dasha, and Lucius; wrapper parents remained alive and auto-restarted through current `launch-agent.sh`.
- Verified all four agents now run `codex --model gpt-5.5 ... --no-alt-screen /lead-gogo`; Richard confirmed the terminal behavior is fixed.

## Artifacts
- `memory/handoff.md`
- `memory/agent-notes/tmux-masta.md`
- Prior failure receipt: `memory/sessions/2026-05-19_0054_agentremote-terminal-failure-closeout.md`
- Live wrapper scripts inspected: `/tmp/swarmy-agentremote-runtime/chq-mugatu-claude.sh`, `chq-xavier.sh`, `chq-dasha.sh`, `chq-lucius.sh`

## Carryover
- First check for future AgentRemote terminal drift: compare live process age and command across panes, then restart only stale wrapped child processes.
- Do not patch renderer/tmux code for a behavior mismatch until live process drift has been ruled out.
- Popup sizing/clipping and deploy cleanup remain separate open items.
