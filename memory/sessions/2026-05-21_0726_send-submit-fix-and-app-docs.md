# Send/Submit Fix + Up-to-Date App Docs — 2026-05-21 07:26

## Outcome
Fixed and live-verified the "send-keys not submitting / have to press Enter manually" bug (ALS-LOCAL-006 + ALS-LOCAL-008) via a two-phase send, integrated the prior Codex-Neo dirty work as clean commits, and produced two new docs: an up-to-date app reference and a non-regression "don't break X to fix Y" spec.

## Work
- **Root cause + fix (v1.4.15):** the send path delivered literal text and Enter in ONE tmux invocation, so a raw-mode TUI (Codex/Claude) read text+CR in one read() as a paste (newline in composer) instead of submitting. Fix = two-phase send: literal text, then Enter after `TMUX_SUBMIT_ENTER_DELAY_MS` (120ms) so it lands in its own read. Applied to the broadcast/composer path (`sendKeysToCoord`) and the embedded-terminal submit path (`submitPaneText`). Proven by integration tests (2 reads vs 1 read). Richard relaunched the HUD at v1.4.15 and confirmed live ("test" → "success").
- **Integrated prior dirty work** as logical commits: gitignore graphify scratch; app-code (codex xhigh reasoning, pane owner-matching via `@agent-identity`, Option+Backspace→C-w); v1.4.15 bump; launcher cluster (department resolution, registry pane titles, cleanup script). All 145 node tests + bash launcher tests pass.
- **Deferred `agents.json`** — its dirty diff flips the whole fleet (mugatu/xavier/lucius) from `runtime: codex` to `runtime: claude` (opus-4-7, reasoning max), contradicting the Codex-priority policy and the live Codex panes. Left uncommitted (also gitignored/machine-local) for Richard's call.
- **App reference doc** — `docs/agentremote-reference.md`, the single "how AgentRemote works now (v1.4.15)" reference, built from the live code (verified the model catalog + runtime policy; dropped stale/unconfirmed Explore claims). Uses stable anchors, not line numbers.
- **Non-regression spec** — mined `memory/sessions/` (8 files) + LEARNINGS with subagents, diffed against the live code, and consolidated 23 requirements across 7 collision clusters. Caught a live landmine: the `neo.md` OSC-1337 image-paste note is a stale failed-session diagnosis (code uses a `[image: /path]` text reference) — recorded so it can't trigger a regression.

## Artifacts
- Commits: `32e456f`, `bbeb697`, `e4d2331`, `c43cd4d`, `13732ac`, `805acb6`, `2cf8e1a`, `51fc571`, `8c3052d` (all on `main`, not pushed).
- New: `docs/agentremote-reference.md`, `docs/operations/agentremote-spec-requirements.md`.
- Fix: `remote-app/tmux-send-path.js`, `remote-app/main.js`, `remote-app/test/tmux-send-path*.test.js`, `renderer-static.test.js`.
- LEARNINGS: `LRN-20260521-001` (text+Enter must arrive in separate reads).
- AgentRemote HUD relaunched at v1.4.15 (was PID 61720).

## Followups
- Decide the `agents.json` codex-vs-claude fleet-flip (deferred/uncommitted).
- ALS-LOCAL-001 image paste still wants a dedicated live paste check.
- Commits are local only; push when Richard asks.
- `memory/audits|decisions|workflows|coord` are empty placeholders if durable records are wanted there.
