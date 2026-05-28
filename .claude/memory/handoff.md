# Handoff — Neo (`neo`)

## Active thread (overwritten each /chores — read FIRST at startup)

**Last working on:** 2026-05-28. Three units, all pushed to `main`: (1) Claude **"default" model** tracking the CC default → Opus 4.8 — launcher omits `--model` for `"default"`/empty so CC picks its recommended model; `harness-models.json` + `main.js` + tests + doc; 8 Claude agents repointed; **AgentRemote v1.5.0, HUD relaunched (PID 49182)**. (2) Fixed **`startup_lines` array silently dropping `startup_slash`** (hansel never ran `/lead-gogo`) — array now augments, not replaces; regression-tested (`ac66f1c`). (3) **`theme_color` → statusline banner color** — launcher exports `AGENT_STATUSLINE_COLOR`, the global statusline paints the banner that hex (cyan fallback); banner now matches the HUD tile (`073f24e` + global edit).

**State (2026-05-28):** Opus 4.8 is the default model fleet-wide. HUD on v1.5.0. The `/color` "not working" symptom was **likely Richard's own settings reset** (he conceded "might be mistaken… it's working"); the `startup_slash` drop was a real, proven bug. Banner-color change left IN (offered revert; Richard ran `/done` without reverting).

**Next verifiable step:** the 4 running agents (mugatu/neo/dasha/kenpachi) need **relaunch** to show the new banner color + pick up the `startup_slash` fix (they launched before the change). The global `~/.claude/statusline-command-fancy.sh` edit is **NOT version-controlled** — lost on a `~/.claude` reset.

**Pending uncommitted:** Richard's `agents.json` kenpachi edit (repurposed codex→claude @ `ecommerce/ecom-os`) committed this chores (attributed). `docs/references/tmux.wiki alias` (??) is not mine.

**Session-end note:** Per [[feedback_dont_close_richards_running_apps]], did NOT auto-kill the Neo session on `/done`.

## Open priorities (<=5)

- [APPROVAL-GATED] **Stale MCP / session-shutdown cleanup** (#6) — needs Richard's OK to edit global `~/.claude/settings.json` hooks. NB: the launcher contract test fires `codex-mcp-cleanup.sh`, which kills live MCP helpers (claude-peers/zero-context/notebooklm) — recoverable but disruptive to active peers.
- [RICHARD-ACTION] **Codex keys** — iTerm Default profile Left/Right Option Key → Esc+. [[reference_codex_keys_iterm_fix]]
- [OPTIONAL] **Version the global statusline script** — `~/.claude/statusline-command-fancy.sh` holds the per-agent banner-color logic but is unversioned.
- [OPTIONAL] **Codex keybind durability** (#4) — sourced tmux conf loaded on Attach (swarmy lane).
- Paused: AgentRemote public-release prep [[project_agentremote_public_release]]; Shift+Enter cross-pane CR [[project_iterm_broadcast_extra_cr]].

## Cross-session comms

- None outstanding.
