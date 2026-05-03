# Council Spec — v0

**Status:** SPEC. Build greenlit by Richard 2026-05-03 09:45Z. ACRM tasks pending file via Xavier.

## Source docs

- Swarmy's proposal: `~/ai_projects/swarmy/workspace/council-spawn/proposal.md`
- Gekko's sentinel refinement: posted to team channel 2026-05-03 09:25Z (Stop-hook sentinel via fs.watch, supersedes pipe-pane scrape)
- Topic-brief curation rule: Lucius/Gekko convergence 09:27Z (curated operator-relevant slice, not blank-slate, not auto-frontload)

## What it is

Spawn-on-demand bounded-membership group brainstorm. Richard picks 2-3 agents + a topic; council members are FRESH claude sessions (not running ops); a router fans replies between them via `tmux send-keys`; UI shows the transcript; `/disperse` tears it down.

Replaces nothing existing. Sits alongside claude-peers (intra-Claude dyad push) and the message-agent JSONL channel + hook (cross-model + low-frequency broadcasts).

## Components + ownership

| Component | Owner | Description |
|---|---|---|
| `council-spawn.sh` | tmux-master | Bash launcher, same shape as `chq-tmux.sh`. Args: council-id, comma-list of bare names, topic brief path. Creates one tmux window per member, claude session with `--settings <per-council-template>`. |
| Per-council `--settings` template | tmux-master | JSON with one Stop hook entry that touches `~/.message-agent/councils/<id>/sentinels/<member>` on end-of-turn. Plus topic-brief loaded as system-prompt addendum. |
| Router daemon | swarmy | launchd-managed Python daemon. fs.watches both the per-council JSONL and the sentinels dir. On new envelope, gates fanout per receiver: only `tmux send-keys -l "<from>: <body_truncated>"` + `Enter` when receiver-N's sentinel mtime > last-send-to-N timestamp. |
| Truncator (v0) | swarmy | In-router. Length-cap (~256 chars) + regex-strip `<function_calls>` blocks + strip `<system-reminder>` and `<message-agent-inbox>` wrappers + `MEMORY.md` frontload. No LLM in path. |
| Topic-brief generator | author of /council | Hand-curated context: relevant prior decisions, open questions, memory pointers. NOT auto-frontloaded operator state. |
| Councils tab in agent-remote | tmux-master | ~50 LOC on top of the existing chat panel. Multi-tab UI (Team, Councils). Per-council subtab shows transcript JSONL filtered to `type=council_message`. `/council <names> about <topic>` and `/disperse <id>` commands typed from the tab. |
| Per-council JSONL storage | shared | `~/.message-agent/councils/<id>/transcript.jsonl`. Same envelope shape as team channel + extra fields: `council_id`, `type` taxonomy (`council_message` shown in UI, `council_relay` hidden). |

## Lifecycle

1. **Spawn:** Richard runs `/council xavier,lucius about <topic>`. Spawner creates `~/.message-agent/councils/<id>/{sentinels/, transcript.jsonl}`. Two new tmux windows: `council-<id>-xavier`, `council-<id>-lucius`. Each runs claude with the per-council settings + topic brief.
2. **Deliberate:** Richard posts to the council via the agent-remote Councils tab → write to transcript.jsonl. Router fans to each member's pane. Members reply by writing back to transcript.jsonl (via `agent_bus_send.sh --to council-<id>` or equivalent — Swarmy specs the exact CLI shape). Router fans replies to OTHER members.
3. **Disperse:** `/disperse <id>` → router stops watching, kill the windows, transcript JSONL stays for ~7 days as audit trail.

## Lifecycle gates

- Explicit `/disperse`
- 30-min idle TTL fallback (no new transcript rows for 30 min → auto-disperse)
- Window kill on disperse, transcript retained

## ACRM task breakdown (for Xavier to file)

Suggested gate pattern — these can land in parallel after T1 ships:

- **T1 (foundation):** swarmy ships the per-council JSONL convention + `agent_bus_send.sh --to council-<id>` route. Unblocks all other tasks.
- **T2 (spawner):** tmux-master ships `council-spawn.sh` + per-council `--settings` template. Smoke-test by spawning a 2-member council manually and confirming Stop hook touches sentinels.
- **T3 (router):** swarmy ships the launchd-managed router daemon. Depends on T1 (JSONL) + T2 (sentinels). Truncator v0 inline.
- **T4 (UI):** tmux-master ships the Councils tab in agent-remote. Depends on T1 (JSONL shape stable). Multi-tab refactor + per-council subtab.
- **T5 (commands):** tmux-master wires `/council` and `/disperse` slash-commands in the Councils tab to invoke `council-spawn.sh` and the router's stop signal. Depends on T2 + T3.

## Hard constraints

- **Bare names canonical** for all identifiers (per Richard's 2026-05-03 09:30Z rename directive). Tmux window names: `council-<id>-xavier` not `council-<id>-claude-xavier`.
- **No auto-frontload of operator state** in council members' system prompts — topic brief is hand-curated, not memory-tier-1 or `/gogo`-style ingest.
- **No build of features beyond v0.** No LLM truncation (v2). No multi-channel councils. No reuse-existing-pane mode. No persistent always-on councils. Single-purpose, ephemeral, bounded.
- **Router never types into busy panes** — sentinel-gated only.

## Out of scope (for later if needed)

- LLM-summarizer truncation (v2)
- Per-message threading inside a council
- Persistent councils that survive across sessions
- Council templates / saved memberships
- Cross-council memory transfer
