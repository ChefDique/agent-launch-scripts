# Handoff — Neo (`tmux-masta`)

## Last working on

AgentRemote iteration: 12 commits today (`v1.1.27` → `v1.3.5`) covering pet animation row fix, Codex transcript 30d cutoff, model picker (settings popover + add-agent form), pet hover greeting, avatar cropper bug fixes, settings-popover avatar pick + Armory unhide. Persistent "wrong session pet chat" complaint isolated to a **slug variant collision** in `remote-app/agent-transcript-source.js` — two `~/.claude/projects/` directories exist for the same cwd (dashes vs underscores for `_`); `resolveTranscriptFile` picks the first slug candidate that has any file, so a stale slug shadows the live one. Fix designed but not shipped (context full).

## Open priorities

- [ACTIVE] Wrong-session pet chat root cause — `claudeProjectSlugCandidates` returns both `-Users-richardadair-ai-projects-CorporateHQ` (`_→-`) and `-Users-richardadair-ai_projects-CorporateHQ` (preserved `_`); `resolveTranscriptFile` returns first-slug-with-jsonl. Fix: gather candidates across BOTH slugs, then apply latest-mtime + title filter. File: `remote-app/agent-transcript-source.js:160-165`.
- [PENDING-RICHARD] Bypass-perms walkback to Swarmy. Sent two coord drops today: `--auto-send-task` (uncontroversial) + `--permission-mode bypassPermissions` default. Later realized the latter contradicts the worktree-only instructional contract — cropper agent proved it by committing directly to main. Options: (a) walk back the bypass-perms default (eat prompt friction), (b) sandbox-exec the agent (heavy lift). Not chosen yet.
- [DEFER] Move user-customized avatars from `remote-app/assets/` (git-tracked) to `~/Library/Application Support/AgentRemote/avatars/`. Requires custom protocol (`agentremote-avatar://`) or absolute-path convention so renderer resolves both locations. Multi-file refactor.
- [PENDING-RICHARD] Telegram bot 401 for Neo/`tmux-masta` channel — token revoked, needs reissue via @BotFather.
- [DEFER] ALS-008 per-project orchestrator + ALS-001/002/003 dispatch_pending — bumped to high by Xavier 2026-05-04, still waiting.

## Cross-session comms

- 2026-05-09 Richard: persistent wrong-session pet chat across reloads — slug variant collision identified late in session, fix deferred. Cropper testing pollution (hansel/mugatu/vegeta/zoolander/etc. images in `remote-app/assets/`) intentional, leave dirty.
- 2026-05-09 Swarmy (`overlord-swarmy-hermes`): two coord drops sent — `cid neo-claude-to-overlordswarmy-1778356367` (auto-send-task) + `cid neo-claude-to-overlordswarmy-1778357741` (permission-mode default). Second one needs walkback per above. Not yet acknowledged.
- 2026-05-09 Cropper builder agent: violated worktree-only instruction by committing v1.3.0 directly to `main` (`791b96a`). Work shipped + tests pass but the safety-rail proved cosmetic with bypass-perms on. Worktree cleanup auto-handled by /chores ledger.

<!-- prior handoff history at `git log --oneline -- .claude/memory/handoff.md`; cross-session memory at /Users/richardadair/.claude/projects/-Users-richardadair-ai-projects-agent-launch-scripts/memory/MEMORY.md -->
