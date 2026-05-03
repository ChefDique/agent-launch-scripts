---
name: gogo
description: Operator-station session-entry for the meta-agent in ~/agent-launch-scripts. Confirms AgentRemote + launch-infra liveness, peer fleet, and outstanding workstreams from CLAUDE.md, ending with one stated next action. Use at the start of every session in this directory.
user-invocable: true
disable-model-invocation: false
---

# /gogo — Meta-Agent Session-Entry

You are starting (or resuming) work as the meta-agent / operator-station maintainer in `~/agent-launch-scripts`. Sister-level to the chq fleet, NOT one of them. Your turf: the launch scripts (`launch-agent.sh`, `chq-tmux.sh`, `agents.json`), the Electron HUD at `remote-app/` (AgentRemote), and the cross-fleet operations that run from this chair.

Run all of these in parallel, then present status:

```bash
git status --porcelain | head -20                                       # uncommitted infra changes?
git log --oneline -10                                                    # trajectory
jq '.agents | length, [.agents[].id]' agents.json                        # registry sanity
pgrep -fl "Electron.*remote-app" | head -3                               # AgentRemote alive?
tail -5 remote-app/out.log                                               # last AgentRemote boot/shortcut events
tmux ls 2>/dev/null | head -5                                            # active tmux sessions (chq, etc.)
ls -1 .claude/skills 2>/dev/null                                         # local skills bench
```

Then via MCP:

- `mcp__claude-peers__list_peers --scope=machine` — peer fleet roster (Xavier, Lucius, Gekko, Swarmy, plus any swarmy-spawned). Their CWDs disambiguate. Note that `directory`/`repo` scopes return zero from this CWD because no peer shares it.
- `mcp__claude-peers__set_summary` — set your own one-liner summary so peers see what you're working on.

## Present status (4-6 lines)

Cover, in order:
1. Most recent commit + uncommitted state
2. AgentRemote: running yes/no, last shortcut event from out.log
3. Fleet: which peers are up, any active swarmy spawns
4. Outstanding workstreams from CLAUDE.md "Active workstreams" section — flag if any have changed status since the file's last edit
5. End with `startup ingest: ~X% context`

## State exactly ONE primary next action

Pick from CLAUDE.md "Outstanding for AgentRemote" backlog OR an explicit follow-up from the prior session's commits OR a peer-message-implied task. Default to **executing** — operator-station work is inside the prior session's grant. Use the threshold question from `~/.claude/rules/decision-discipline.md` before pinging Richard for any approval.

If a parallel-track action is independent, name it as a one-line addendum.

## Critical rules — operator-station discipline

- **Dispatch to `tmux-electron-master` for UI / aesthetic / Electron-internals work.** It's the specialist. This Claude orchestrates. Subagent definition lives at `.claude/agents/tmux-electron-master.md`.
- **`launch-agent.sh` is the canonical per-agent entrypoint.** All per-agent scripts (xavier.sh, lucius.sh, etc.) call it. `agents.json` is the source of truth for fields. `chq-tmux.sh` `pane_loop` re-reads agents.json each iteration for `auto_restart` — don't break that gate.
- **Process detection: `ps -eo command= | grep 'claude .*-n <Name>'`, never `pgrep -f`** (truncates args past ~200 bytes on macOS).
- **Standard claude flag set** is in `chq-tmux.sh` `CLAUDE_FLAGS` — keep `launch-agent.sh` in sync if you change a flag.
- **Stale-pid cleanup order matters** in the auto-inject: SIGKILL the subshell BEFORE the sleep child. SIGTERM is wrong (bash can trap it). See CLAUDE.md "stale-pid cleanup".
- **Don't touch other departments' files** — peer fleet repos (`~/ai_projects/CorporateHQ`, `/research-and-development`, `/trading`, `/swarmy`) are off-limits except through their owners (peer messages, dispatched subagents, or explicit Richard direction).

## When the session is mid-arc

If memory shows in-flight work (AgentRemote UI iteration, broadcast targeting fix, etc.), pick up where it left off. Check the most recent commit's message for context. Don't restart a closed thread.
