# 2026-05-28 — Claude "default" model + startup_slash augment + statusline color

**Outcome:** Three units, all pushed to `main`.

1. **Claude "default" model tracking the CC default (Opus 4.8).** Richard set Opus 4.8 as `/model default`. Launcher hardcoded `claude-opus-4-7[1m]` and always passed `--model`. "default" is the `/model` picker word, NOT a valid `--model` alias (picking it saves no pin). Fix: launcher omits `--model` when model is `"default"`/empty → Claude Code resolves its own recommended default (auto-tracks future bumps). `harness-models.json` gains a `default` sentinel + explicit 4.8 entries; `main.js` fallback; tests + doc table refreshed; 8 Claude agents repointed to `default`. AgentRemote v1.4.17→v1.5.0, HUD relaunched (PID 49182). Commits `bc6a75e`, `1b4f729`; cross-lane `agents.json` rescue `95dec09`. See [[reference-claude-default-model-sentinel]].

2. **`startup_lines` array silently dropped `startup_slash` (the real "as-if-hardcoded" bug).** `read_startup_lines()` returned early on an array, sending ONLY those lines — hansel (`["/color pink"]` + `startup_slash /lead-gogo`) never ran `/lead-gogo`; xavier only worked via a hand-duplicated `/lead-gogo`; the 7 array-less agents were fine. Fix: array now AUGMENTS — re-appends `/rename` (Claude) + `startup_slash` unless already present (exact-match dedup). Proven via stubbed-tmux dry-run; regression test added (exclude-enter + intentional fixtures). Commit `ac66f1c`.

3. **`theme_color` → statusline banner color.** The `[Model]` banner in global `~/.claude/statusline-command-fancy.sh` was hardcoded CYAN and ignores `/color`. Launcher now exports `theme_color` as `AGENT_STATUSLINE_COLOR`; statusline renders it (24-bit ANSI), cyan fallback. Banner now matches the HUD tile. Commit `073f24e` (launcher half) + global statusline edit (**NOT version-controlled**).

**Note:** Richard's "/color doesn't work" symptom was likely his own settings reset ("I might be mistaken… it's working"). The `startup_slash` drop was a real, proven bug regardless. Offered to revert the banner-color change; Richard ran `/done` without reverting → kept.

**Artifacts:** commits `bc6a75e`, `95dec09`, `1b4f729`, `ac66f1c`, `073f24e` (pushed); live edit to `~/.claude/statusline-command-fancy.sh` (unversioned).
